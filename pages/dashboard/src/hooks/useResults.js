import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, or, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/* ─── IELTS Band Conversion ─── */
export function convertToIELTS(score, total, type) {
  if (type === 'writing') return null;
  if (type === 'fullmock') return null;
  const n = Math.round((score / (total || 40)) * 40);
  if (n >= 39) return 9.0;
  if (n >= 37) return 8.5;
  if (n >= 35) return 8.0;
  if (n >= 33) return 7.5;
  if (n >= 30) return 7.0;
  if (n >= 27) return 6.5;
  if (n >= 23) return 6.0;
  if (n >= 19) return 5.5;
  if (n >= 15) return 5.0;
  if (n >= 13) return 4.5;
  if (n >= 10) return 4.0;
  return 3.5;
}

export function getBandClass(band) {
  const s = parseFloat(band);
  if (s >= 9.0) return 'band-9';
  if (s >= 8.0) return 'band-8';
  if (s >= 7.0) return 'band-7';
  if (s >= 6.0) return 'band-6';
  if (s >= 5.0) return 'band-5';
  return 'band-low';
}

export function getTypeIcon(type) {
  return { listening: '🎧', reading: '📖', writing: '✍️', fullmock: '🎓' }[type] || '📝';
}

export function formatType(type) {
  return { listening: 'Listening', reading: 'Reading', writing: 'Writing', fullmock: 'Full Mock' }[type] || type;
}

const COLLECTIONS = {
  listening: 'resultsListening',
  reading: 'resultsReading',
  writing: 'resultsWriting',
  fullmock: 'resultFullmock',
};

const TEST_COLLECTIONS = {
  listening: 'listeningTests',
  reading: 'readingTests',
  writing: 'writingTests',
  fullmock: 'fullmockTests',
};

/* ─── Fetch results for a skill ─── */
async function fetchResults(userId, type) {
  const col = COLLECTIONS[type];
  if (!col) return [];
  try {
    const userEmail = auth?.currentUser?.email || "MISSING_EMAIL";
    const q = query(collection(db, col), or(
      where('userId', '==', userId),
      where('name', '==', userEmail),
      where('email', '==', userEmail)
    ));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, type, ...d.data() }));
    
    // Fetch titles
    await Promise.all(results.map(async (r) => {
      if (r.type === 'reading' || r.type === 'fullmock') {
        const num = r.testId ? (r.testId.match(/\d+/) ? r.testId.match(/\d+/)[0] : '') : '';
        r.displayTitle = `${formatType(r.type)} Test ${num}`.trim();
      } else if (r.type === 'listening' || r.type === 'writing') {
        if (r.testId) {
          try {
            const testDocRef = doc(db, TEST_COLLECTIONS[r.type], r.testId);
            const testDocSnap = await getDoc(testDocRef);
            if (testDocSnap.exists()) {
              const data = testDocSnap.data();
              r.displayTitle = data.title || data.name || `${formatType(r.type)} Test ${r.testId.match(/\d+/)?.[0] || ''}`.trim();
            } else {
              r.displayTitle = `${formatType(r.type)} Test ${r.testId.match(/\d+/)?.[0] || ''}`.trim();
            }
          } catch (e) {
            r.displayTitle = `${formatType(r.type)} Test ${r.testId.match(/\d+/)?.[0] || ''}`.trim();
          }
        } else {
          r.displayTitle = `${formatType(r.type)} Test`;
        }
      }
    }));

    results.sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : (a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0));
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : (b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0));
      return db2 - da;
    });
    return results;
  } catch {
    return [];
  }
}

/* ─── Hook: all results across skills ─── */
export function useAllResults(userId) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const all = [];
      for (const type of Object.keys(COLLECTIONS)) {
        const r = await fetchResults(userId, type);
        all.push(...r);
      }
      all.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : (a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0));
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : (b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0));
        return db2 - da;
      });
      if (!cancelled) {
        setResults(all);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { results, loading };
}

/* ─── Hook: results for single skill ─── */
export function useSkillResults(userId, type) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !type) return;
    let cancelled = false;
    fetchResults(userId, type).then(r => {
      if (!cancelled) { setResults(r); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [userId, type]);

  return { results, loading };
}

/* ─── Hook: latest result per skill (for Home stat cards) ─── */
export function useLatestResults(userId) {
  const [latest, setLatest] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const out = {};
      for (const type of Object.keys(COLLECTIONS)) {
        const r = await fetchResults(userId, type);
        out[type] = r.length > 0 ? r[0] : null;
      }
      if (!cancelled) { setLatest(out); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { latest, loading };
}

/* ─── Hook: tests for a skill ─── */
export function useTests(type) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) return;
    const col = TEST_COLLECTIONS[type];
    if (!col) return;
    setTests([]);
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, col));
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const an = parseInt((a.testId || a.title || a.id).match(/\d+/)?.[0] || '0');
          const bn = parseInt((b.testId || b.title || b.id).match(/\d+/)?.[0] || '0');
          return an - bn;
        });
        if (!cancelled) { setTests(arr); setLoading(false); }
      } catch {
        if (!cancelled) { setTests([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [type]);

  return { tests, loading };
}

/* ─── Fetch latest user result for a specific test ─── */
export async function getUserTestResult(userId, type, testId) {
  const col = COLLECTIONS[type];
  if (!col) return null;
  try {
    const q = query(
      collection(db, col),
      where('userId', '==', userId),
      where('testId', '==', testId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, type, ...d.data() };
    }
    return null;
  } catch {
    return null;
  }
}

/* ─── Result URL mappings ─── */
export function getResultUrl(type, resultId) {
  const urls = {
    listening: `/pages/mock/listening/result/?id=${resultId}`,
    reading: `/pages/mock/reading/result/?id=${resultId}`,
    writing: `/pages/mock/writing/result/?id=${resultId}`,
    fullmock: `/pages/mock/full/result/?id=${resultId}`,
  };
  return urls[type] || '#';
}

export function getTestUrl(type, testId) {
  const urls = {
    listening: `/pages/mock/listening/test.html?testId=${testId}`,
    reading: `/pages/mock/reading/test.html?testId=${testId}`,
    writing: `/pages/mock/writing/test.html?testId=${testId}`,
    fullmock: `/pages/mock/full/fullMock.html?testId=${testId}`,
  };
  return urls[type] || '#';
}

export function getScoreDisplay(result) {
  if (result.type === 'fullmock') {
    return `Band ${result.overallBand || 'N/A'}`;
  }
  if (result.type === 'writing') {
    return `${result.totalWordCount || 0} words`;
  }
  const band = convertToIELTS(result.score || 0, result.total || 40, result.type);
  return `${result.score || 0}/${result.total || 40} (Band ${band})`;
}

export function getLatestBand(result) {
  if (!result) return '—';
  if (result.type === 'fullmock') return result.overallBand || '—';
  if (result.type === 'writing') return `${result.totalWordCount || 0}w`;
  return convertToIELTS(result.score || 0, result.total || 40, result.type);
}

/* ─── Hook: New Dashboard Stats ─── */
export function useDashboardStats(userId) {
  const { results, loading } = useAllResults(userId);
  const [stats, setStats] = useState({
    bestScore: null,
    strongSkill: { name: 'Listening', score: '0.0' },
    weakArea: { name: 'Reading', score: '0.0' },
    totalTests: 0,
    activity: {}
  });

  useEffect(() => {
    if (loading) return;
    
    let bestScoreObj = null;
    let maxBand = -1;
    let listeningTotal = 0, listeningCount = 0;
    let readingTotal = 0, readingCount = 0;
    const activityMap = {};

    results.forEach(r => {
      // Activity Calendar Date
      let dateObj = r.createdAt?.toDate ? r.createdAt.toDate() : (r.submittedAt?.toDate ? r.submittedAt.toDate() : null);
      if (dateObj) {
        // Adjust for timezone explicitly or just use local date string
        const dateStr = dateObj.toLocaleDateString('en-CA'); // format: YYYY-MM-DD
        activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
      }

      // Best Score
      let band = 0;
      if (r.type === 'fullmock') {
        band = parseFloat(r.overallBand) || 0;
      } else if (r.type === 'listening' || r.type === 'reading') {
        const val = convertToIELTS(r.score || 0, r.total || 40, r.type) || 0;
        band = parseFloat(val);
      }

      if (band > maxBand) {
        maxBand = band;
        bestScoreObj = { band, type: r.type, id: r.id };
      }

      // Strong/Weak Skills
      if (r.type === 'listening') {
        listeningTotal += band;
        listeningCount++;
      } else if (r.type === 'reading') {
        readingTotal += band;
        readingCount++;
      }
    });

    const avgL = listeningCount > 0 ? listeningTotal / listeningCount : 0;
    const avgR = readingCount > 0 ? readingTotal / readingCount : 0;
    
    let strongSkill = { name: 'Reading', score: '0.0' };
    let weakArea = { name: 'Listening', score: '0.0' };

    if (listeningCount > 0 || readingCount > 0) {
      if (avgL >= avgR) {
        strongSkill = { name: 'Listening', score: avgL.toFixed(1) };
        weakArea = { name: 'Reading', score: Math.max(0, avgR).toFixed(1) };
      } else {
        strongSkill = { name: 'Reading', score: avgR.toFixed(1) };
        weakArea = { name: 'Listening', score: avgL.toFixed(1) };
      }
    }

    setStats({
      bestScore: bestScoreObj,
      strongSkill,
      weakArea,
      totalTests: results.length,
      activity: activityMap
    });

  }, [results, loading]);

  return { stats, loading };
}

/* ─── Hook: Target Score ─── */
export function useTargetScore(userId, userEmail) {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;

    (async () => {
      try {
        const q = query(collection(db, 'userTargets'), where('email', '==', userEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          if (!cancelled) {
            setTarget(snap.docs[0].data().target);
            setLoading(false);
          }
        } else {
          if (!cancelled) {
            setTarget(null);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setTarget(null);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userEmail]);

  const saveTargetScore = async (newTarget) => {
    if (!userEmail) return false;
    try {
      const q = query(collection(db, 'userTargets'), where('email', '==', userEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docRef = doc(db, 'userTargets', snap.docs[0].id);
        await setDoc(docRef, { email: userEmail, target: parseFloat(newTarget) }, { merge: true });
      } else {
        const newDocRef = doc(collection(db, 'userTargets'));
        await setDoc(newDocRef, { email: userEmail, target: parseFloat(newTarget) });
      }
      setTarget(parseFloat(newTarget));
      return true;
    } catch (err) {
      console.error("Error saving target score", err);
      return false;
    }
  };

  return { target, saveTargetScore, loading };
}
