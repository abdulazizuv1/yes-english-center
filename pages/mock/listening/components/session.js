// The student's sitting, kept on this computer.
//
// Every change is written straight to localStorage, which works with no
// internet at all, so a refresh, a crash or a dropped connection costs
// nothing. The key includes the student's uid and the test: the old page
// kept one set of answers for every listening test and every student on
// the computer ("listeningTestAnswers"), so the next test, or the next
// student, opened with someone else's answers in it.
import { listeningState } from "./state.js?v=3.4";

const PREFIX = "ielts-listening:v2";

let storageBroken = false;
const listeners = new Set();

// The mock and analyse mode are separate sittings of the same test:
// switching mode never carries a running exam into the untimed page, or
// the other way round.
export const sessionKey = (uid, testId, mode = listeningState.mode) =>
  mode === "analyse" ? `${PREFIX}:${uid}:${testId}:analyse` : `${PREFIX}:${uid}:${testId}`;

function makeAttemptId(uid, testId) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${testId}-${uid.slice(0, 8)}-${Date.now().toString(36)}-${rand}`;
}

export function newSession(uid, testId, now = Date.now()) {
  return {
    v: 2,
    attemptId: makeAttemptId(uid, testId),
    startedAt: null,    // "Start test" was pressed
    anchor: null,       // mock: when the recording would have started had it
                        // never stopped. See audio.js.
    pos: 0,             // analyse: where the recording is, ms
    paused: false,      // analyse: the student paused the test
    elapsed: 0,         // analyse: time spent, ms (stops while paused)
    durations: [],      // seconds, one per recording file
    answers: {},
    flags: [],          // qIds marked for review
    marks: [],          // highlights and notes, see marks.js
    part: 0,
    current: null,      // the question the student is on
    scroll: {},         // part -> scroll offset of the questions
    settings: { size: "standard", contrast: "bw" },
    volume: 0.8,
    timerHidden: false,
    pinOk: false,
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
  let session = read(sessionKey(uid, testId));
  if (!session || session.v !== 2) session = newSession(uid, testId);

  // anything missing from an older save gets its default
  const blank = newSession(uid, testId);
  for (const k of Object.keys(blank)) {
    if (session[k] === undefined) session[k] = blank[k];
  }
  session.settings = { ...blank.settings, ...(session.settings || {}) };

  // the old page's shared keys: never anyone's answers to keep
  try { localStorage.removeItem("listeningTestAnswers"); } catch { /* nothing to clean */ }

  listeningState.session = session;
  saveSession();
  return session;
}

/** Writes the sitting now. Called on every change: it is small and fast. */
export function saveSession() {
  const s = listeningState.session;
  const u = listeningState.user;
  if (!s || !u) return false;
  s.savedAt = Date.now();
  try {
    localStorage.setItem(sessionKey(u.uid, listeningState.testId), JSON.stringify(s));
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
  const u = listeningState.user;
  if (!u) return;
  try { localStorage.removeItem(sessionKey(u.uid, listeningState.testId)); } catch { /* gone already */ }
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
