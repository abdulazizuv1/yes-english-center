// The student's sitting, kept on this computer.
//
// Every change is written straight to localStorage, which works with no
// internet at all, so a refresh, a crash or a dropped connection costs
// nothing. The key includes the student's uid: the centre's computers are
// shared, and the old key (readingTest_<testId>) handed one student's
// answers to the next student who opened the same test.
import { readingState } from "./state.js?v=3.2";

const PREFIX = "ielts-reading:v2";
export const TEST_DURATION_MS = 60 * 60 * 1000;

// The old page kept answers under a key without a uid. A student who is
// mid-test when this version ships should not lose their work, but on a
// shared computer an old entry may belong to someone else, so only an
// attempt from the last three hours (a test is one hour) is carried over.
const LEGACY_WINDOW_MS = 3 * 60 * 60 * 1000;

let storageBroken = false;
const listeners = new Set();

export const sessionKey = (uid, testId) => `${PREFIX}:${uid}:${testId}`;

function makeAttemptId(uid, testId) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${testId}-${uid.slice(0, 8)}-${Date.now().toString(36)}-${rand}`;
}

export function newSession(uid, testId, now = Date.now()) {
  return {
    v: 2,
    attemptId: makeAttemptId(uid, testId),
    startedAt: null,    // set when the questions first appear
    deadline: null,     // startedAt + one hour; the clock counts to this
    answers: {},
    flags: [],          // qIds marked for review
    marks: [],          // highlights and notes, see marks.js
    part: 0,
    current: null,      // the question the student is on
    scroll: {},         // part -> { passage, questions } scroll offsets
    split: 0.5,         // passage pane width, as a fraction
    settings: { size: "standard", contrast: "bw" },
    timerHidden: false,
    pausedAt: null,     // staff paused the clock at this moment
    finished: false,    // true once submitted (sent or still waiting)
    payload: null,      // the result waiting to be sent
    savedAt: now,
  };
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Loads the student's sitting, or starts one. */
export function loadSession(uid, testId) {
  const key = sessionKey(uid, testId);
  let session = read(key);

  if (!session || session.v !== 2) {
    session = newSession(uid, testId);
    carryOverLegacy(testId, session);
  }

  // anything missing from an older save gets its default
  const blank = newSession(uid, testId);
  for (const k of Object.keys(blank)) {
    if (session[k] === undefined) session[k] = blank[k];
  }
  session.settings = { ...blank.settings, ...(session.settings || {}) };

  readingState.session = session;
  saveSession();
  return session;
}

function carryOverLegacy(testId, session) {
  const legacyKey = `readingTest_${testId}`;
  const legacy = read(legacyKey);
  if (!legacy) return;
  const fresh = legacy.timestamp && Date.now() - legacy.timestamp < LEGACY_WINDOW_MS;
  if (fresh && legacy.answers && typeof legacy.answers === "object") {
    session.answers = { ...legacy.answers };
  }
  try { localStorage.removeItem(legacyKey); } catch { /* nothing to clean */ }
}

/** Writes the sitting now. Called on every change: it is small and fast. */
export function saveSession() {
  const s = readingState.session;
  const u = readingState.user;
  if (!s || !u) return false;
  s.savedAt = Date.now();
  try {
    localStorage.setItem(sessionKey(u.uid, readingState.testId), JSON.stringify(s));
    if (storageBroken) {
      storageBroken = false;
      listeners.forEach((fn) => fn(true));
    }
    return true;
  } catch (err) {
    // private windows and full disks refuse writes; the student must know
    if (!storageBroken) {
      storageBroken = true;
      listeners.forEach((fn) => fn(false, err));
    }
    return false;
  }
}

export function clearSession() {
  const u = readingState.user;
  if (!u) return;
  try { localStorage.removeItem(sessionKey(u.uid, readingState.testId)); } catch { /* gone already */ }
}

/** Tells the page when saving starts failing, or works again. */
export function onStorageHealth(fn) {
  listeners.add(fn);
}

// last chance to write before the tab closes or goes to the background
export function saveOnLeave() {
  const flush = () => saveSession();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
