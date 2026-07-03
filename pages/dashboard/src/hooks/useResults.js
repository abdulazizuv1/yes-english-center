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

/* ─── Shared timestamp helpers ─── */
function tsOf(r) {
  if (r.createdAt?.toDate) return r.createdAt.toDate();
  if (r.submittedAt?.toDate) return r.submittedAt.toDate();
  return new Date(0);
}

function byNewest(a, b) {
  return tsOf(b) - tsOf(a);
}

/* ─── Test title resolution with module-level cache ───
   Titles come from a handful of test docs, so fetch each test doc at most
   once per session instead of once per result row. */
const titleCache = new Map(); // "type:testId" -> title string

function fallbackTitle(type, testId) {
  const num = testId?.match(/\d+/)?.[0] || '';
  return `${formatType(type)} Test ${num}`.trim();
}

async function resolveDisplayTitles(results) {
  // reading/fullmock always use the numeric fallback — no fetch needed
  results.forEach(r => {
    if (r.type === 'reading' || r.type === 'fullmock') {
      r.displayTitle = fallbackTitle(r.type, r.testId);
    } else if (!r.testId) {
      r.displayTitle = `${formatType(r.type)} Test`;
    }
  });

  // listening/writing use the test doc title — batch-fetch unique uncached ids
  const pending = new Map(); // cacheKey -> {type, testId}
  results.forEach(r => {
    if ((r.type === 'listening' || r.type === 'writing') && r.testId) {
      const key = `${r.type}:${r.testId}`;
      if (!titleCache.has(key)) pending.set(key, { type: r.type, testId: r.testId });
    }
  });

  await Promise.all([...pending.values()].map(async ({ type, testId }) => {
    const key = `${type}:${testId}`;
    try {
      const snap = await getDoc(doc(db, TEST_COLLECTIONS[type], testId));
      const data = snap.exists() ? snap.data() : null;
      titleCache.set(key, data?.title || data?.name || fallbackTitle(type, testId));
    } catch (err) {
      console.error(`Failed to fetch ${type} test title for ${testId}:`, err);
      titleCache.set(key, fallbackTitle(type, testId));
    }
  }));

  results.forEach(r => {
    if ((r.type === 'listening' || r.type === 'writing') && r.testId) {
      r.displayTitle = titleCache.get(`${r.type}:${r.testId}`);
    }
  });
}

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

    await resolveDisplayTitles(results);

    results.sort(byNewest);
    return results;
  } catch (err) {
    console.error(`Failed to fetch ${type} results:`, err);
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
      const perType = await Promise.all(
        Object.keys(COLLECTIONS).map(type => fetchResults(userId, type))
      );
      const all = perType.flat().sort(byNewest);
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
      const types = Object.keys(COLLECTIONS);
      const perType = await Promise.all(types.map(type => fetchResults(userId, type)));
      const out = {};
      types.forEach((type, i) => {
        out[type] = perType[i].length > 0 ? perType[i][0] : null;
      });
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
    let cancelled = false;
    (async () => {
      setTests([]);
      setLoading(true);
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
      } catch (err) {
        console.error(`Failed to fetch ${type} tests:`, err);
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
  } catch (err) {
    console.error(`Failed to fetch ${type} result for test ${testId}:`, err);
    return null;
  }
}

/* ─── Hook: ALL users' results for a skill (admin) ─── */
export function useAllUsersResults(type) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) return;
    const col = COLLECTIONS[type];
    let cancelled = false;
    (async () => {
      if (!col) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const snap = await getDocs(collection(db, col));
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, type, ...d.data() }));

        await resolveDisplayTitles(arr);

        arr.sort(byNewest);
        if (!cancelled) { setResults(arr); setLoading(false); }
      } catch (err) {
        console.error(`Failed to fetch all ${type} results:`, err);
        if (!cancelled) { setResults([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [type]);

  return { results, loading };
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
    listening: `/pages/mock/listening/test?testId=${testId}`,
    reading: `/pages/mock/reading/test?testId=${testId}`,
    writing: `/pages/mock/writing/test?testId=${testId}`,
    fullmock: `/pages/mock/full/fullMock?testId=${testId}`,
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
      const dateObj = r.createdAt?.toDate ? r.createdAt.toDate() : (r.submittedAt?.toDate ? r.submittedAt.toDate() : null);
      if (dateObj) {
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

/* ─── Hook: AI Writing Feedback results for current user ─── */
export function useAIFeedbackResults(userId) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'aiWritingFeedback'),
          where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, type: 'aifeedback', ...d.data() }));
        arr.sort(byNewest);
        if (!cancelled) { setResults(arr); setLoading(false); }
      } catch (err) {
        console.error('Failed to fetch AI feedback results:', err);
        if (!cancelled) { setResults([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { results, loading };
}

/* ─── Hook: ALL users' AI Writing Feedback (admin) ─── */
export function useAllUsersAIFeedback() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'aiWritingFeedback'));
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, type: 'aifeedback', ...d.data() }));

        // Resolve user names — one fetch per unique user, not per feedback doc
        const uniqueUserIds = [...new Set(arr.map(r => r.userId))];
        const userMap = new Map();
        await Promise.all(uniqueUserIds.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const u = userSnap.data();
              userMap.set(uid, { name: u.name || u.email || uid, email: u.email || '' });
            } else {
              userMap.set(uid, { name: uid, email: '' });
            }
          } catch (err) {
            console.error(`Failed to fetch user ${uid}:`, err);
            userMap.set(uid, { name: uid, email: '' });
          }
        }));

        arr.forEach(r => {
          const u = userMap.get(r.userId) || { name: r.userId, email: '' };
          r.name = u.name;
          r.email = u.email;
        });

        arr.sort(byNewest);
        if (!cancelled) { setResults(arr); setLoading(false); }
      } catch (err) {
        console.error('Failed to fetch all AI feedback:', err);
        if (!cancelled) { setResults([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { results, loading };
}

/* ─── Hook: Reading Analysis results for current user ─── */
export function useReadingAnalyses(userId) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'aiReadingAnalysis'),
          where('userId', '==', userId)
        );
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const da = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0);
          const db2 = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0);
          return db2 - da;
        });
        if (!cancelled) { setAnalyses(arr); setLoading(false); }
      } catch (err) {
        console.error('Failed to fetch reading analyses:', err);
        if (!cancelled) { setAnalyses([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { analyses, loading };
}

/* ─── Hook: ALL users' Reading Analyses (admin) ─── */
export function useAllReadingAnalyses() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, 'aiReadingAnalysis'), limit(100));
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const da = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(0);
          const db2 = b.submittedAt?.toDate ? b.submittedAt.toDate() : new Date(0);
          return db2 - da;
        });
        if (!cancelled) { setAnalyses(arr); setLoading(false); }
      } catch (err) {
        console.error('Failed to fetch all reading analyses:', err);
        if (!cancelled) { setAnalyses([]); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { analyses, loading };
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
        console.error('Failed to fetch target score:', err);
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
