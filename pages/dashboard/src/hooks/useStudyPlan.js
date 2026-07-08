import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const GENERATE_URL = 'https://us-central1-yes-english-center.cloudfunctions.net/generateStudyPlan';

const RESULT_COLLECTIONS = {
  reading: 'resultsReading',
  listening: 'resultsListening',
  writing: 'resultsWriting',
  fullmock: 'resultFullmock',
};

function resultMillis(r) {
  if (r.createdAt?.toMillis) return r.createdAt.toMillis();
  if (r.submittedAt?.toMillis) return r.submittedAt.toMillis();
  if (typeof r.submittedAt === 'string') {
    const t = Date.parse(r.submittedAt);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/* ─── Hook: the student's study plan ─── */
export function useStudyPlan(userId) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Live subscription to the plan document
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(
      doc(db, 'studyPlans', userId),
      (snap) => {
        setPlan(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        console.error('Plan subscription failed:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId]);

  const planVersion = plan?.createdAt?.seconds || 0;

  // Auto-complete site tasks: if a result exists for that test *after* the
  // plan was created, the task is marked "auto" (gray locked checkmark).
  // Runs once per plan version; the guarded write can't loop.
  useEffect(() => {
    if (!userId || !planVersion) return;
    let cancelled = false;
    (async () => {
      try {
        const planCreatedMs = planVersion * 1000;
        const doneTests = {}; // type -> Set(testId)
        await Promise.all(Object.entries(RESULT_COLLECTIONS).map(async ([type, col]) => {
          const snap = await getDocs(query(collection(db, col), where('userId', '==', userId)));
          doneTests[type] = new Set();
          snap.forEach((d) => {
            const r = d.data();
            const ms = resultMillis(r);
            if (r.testId && ms && ms >= planCreatedMs) doneTests[type].add(r.testId);
          });
        }));

        if (cancelled) return;
        // Read the doc fresh so the effect doesn't depend on the plan closure
        const planSnap = await getDoc(doc(db, 'studyPlans', userId));
        if (!planSnap.exists() || cancelled) return;
        let changed = false;
        const days = planSnap.data().days.map((day) => ({
          ...day,
          tasks: day.tasks.map((t) => {
            if (t.kind === 'site' && t.status !== 'auto' && doneTests[t.type]?.has(t.testId)) {
              changed = true;
              return { ...t, status: 'auto' };
            }
            return t;
          }),
        }));
        if (changed) await updateDoc(doc(db, 'studyPlans', userId), { days });
      } catch (err) {
        console.error('Auto-complete check failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, planVersion]);

  // Manual checkbox toggle (external tasks, or site tasks done offline)
  const toggleTask = useCallback(async (dayIndex, taskId) => {
    if (!plan?.days) return;
    const days = plan.days.map((day, i) => {
      if (i !== dayIndex) return day;
      return {
        ...day,
        tasks: day.tasks.map((t) => {
          if (t.id !== taskId || t.status === 'auto') return t;
          return { ...t, status: t.status === 'done' ? 'pending' : 'done' };
        }),
      };
    });
    try {
      await updateDoc(doc(db, 'studyPlans', userId), { days });
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }, [plan, userId]);

  // Generate (or regenerate) via the Cloud Function
  const generatePlan = useCallback(async (input) => {
    setGenerating(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) { setError('not_signed_in'); return false; }
      const idToken = await user.getIdToken();
      const res = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'generation_failed');
        return false;
      }
      return true;
    } catch (err) {
      console.error('Plan generation failed:', err);
      setError('network');
      return false;
    } finally {
      setGenerating(false);
    }
  }, []);

  // Remove the plan entirely (owner delete is allowed by rules)
  const deletePlan = useCallback(async () => {
    try {
      await deleteDoc(doc(db, 'studyPlans', userId));
      return true;
    } catch (err) {
      console.error('Failed to delete plan:', err);
      return false;
    }
  }, [userId]);

  return { plan, loading, generating, error, generatePlan, toggleTask, deletePlan };
}

/* ─── Derived helpers ─── */
export function planProgress(plan) {
  if (!plan?.days) return { done: 0, total: 0, pct: 0 };
  let done = 0;
  let total = 0;
  plan.days.forEach((day) => day.tasks.forEach((t) => {
    total++;
    if (t.status === 'done' || t.status === 'auto') done++;
  }));
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}
