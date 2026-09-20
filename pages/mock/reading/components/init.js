// Starts the reading test and ties the pieces together.
//
// Order matters: the student's saved sitting is loaded before anything is
// drawn, so every answer, highlight, note and review flag is on the page
// from the first frame, on the part they were on, with the clock where it
// was. The test itself is kept on this computer while a sitting is in
// progress, so a refresh with no internet still opens it.
import { readingState } from "./state.js?v=3.2";
import { numberQuestions, buildItems, partOfQuestion } from "./questions.js?v=3.2";
import { loadSession, saveSession, saveOnLeave, TEST_DURATION_MS } from "./session.js?v=3.2";
import { renderPart, questionEl, qIdFromTarget } from "./render.js?v=3.2";
import { buildFooter, updateFooter } from "./nav.js?v=3.2";
import { initMarks } from "./marks.js?v=3.2";
import { startClock, freezeClock } from "./timer.js?v=3.2";
import { createSubmitter, confirmFinish } from "./submit.js?v=3.2";
import { initChrome, applySettings } from "./chrome.js?v=3.2";
import { onAnswerChange } from "./engineCtx.js?v=3.2";
import { initStaffControls, isPaused } from "./staff.js?v=3.2";

// staff who sit tests without a clock
const UNTIMED = new Set(["alisher@yescenter.uz"]);
const TEST_CACHE = (testId) => `ielts-reading:v2:test:${testId}`;
const ROLE_CACHE = (uid) => `ielts-reading:v2:role:${uid}`;
const LOAD_TIMEOUT_MS = 10000;
const ROLE_TIMEOUT_MS = 5000;

// Is this an admin account? The answer is remembered on this computer, so
// the staff controls are still there when the connection is not. A student
// account can only ever cache "student", and the rules behind every write
// are what actually protect the data.
async function isAdminAccount(deps, uid) {
  let cached = null;
  try { cached = localStorage.getItem(ROLE_CACHE(uid)); } catch { /* no storage */ }
  try {
    const snap = await Promise.race([
      deps.getDoc(deps.doc(deps.db, "users", uid)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ROLE_TIMEOUT_MS)),
    ]);
    const role = snap.exists() ? snap.data().role || "" : "";
    try { localStorage.setItem(ROLE_CACHE(uid), role); } catch { /* no storage */ }
    return role === "admin";
  } catch {
    return cached === "admin";
  }
}

function showLoadError(message) {
  const el = document.getElementById("loadError");
  el.querySelector("p").textContent = message;
  el.hidden = false;
  document.body.classList.remove("loading");
}

function waitForPin(correctPin) {
  return new Promise((resolve) => {
    const modal = document.getElementById("pinModal");
    const input = document.getElementById("pinInput");
    const error = document.getElementById("pinError");
    modal.hidden = false;
    input.focus();
    const attempt = () => {
      if (input.value.trim() === String(correctPin)) {
        modal.hidden = true;
        resolve();
      } else {
        error.hidden = false;
        input.value = "";
        input.focus();
      }
    };
    document.getElementById("pinConfirm").addEventListener("click", attempt);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });
  });
}

function readCachedTest(testId) {
  try { return JSON.parse(localStorage.getItem(TEST_CACHE(testId)) || "null"); } catch { return null; }
}

function cacheTest(testId, data) {
  try { localStorage.setItem(TEST_CACHE(testId), JSON.stringify({ data, cachedAt: Date.now() })); } catch { /* optional */ }
}

async function fetchTest(deps, testId, hasSitting) {
  const cached = readCachedTest(testId);
  // mid-sitting, the copy on this computer wins: it opens with no internet,
  // and the test cannot shift under the student if someone edits it
  if (hasSitting && cached?.data) return cached.data;
  try {
    const snap = await Promise.race([
      deps.getDoc(deps.doc(deps.db, "readingTests", testId)),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS)),
    ]);
    if (!snap.exists()) return null;
    const data = snap.data();
    cacheTest(testId, data);
    return data;
  } catch (err) {
    if (cached?.data) return cached.data;
    throw err;
  }
}

export async function initReadingTest(deps) {
  const { auth, onAuthStateChanged } = deps;
  document.body.classList.add("loading");

  // signing in is remembered on this computer, so this works offline too
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
  if (!user) {
    alert("You must be logged in to take the reading test.");
    window.location.href = "/";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  readingState.testId = params.get("testId") || "test-1";
  readingState.user = { uid: user.uid, email: user.email || "" };
  readingState.unlimited = UNTIMED.has(user.email);
  readingState.isAdmin = await isAdminAccount(deps, user.uid);
  document.getElementById("candidate").textContent = user.email || "Candidate";

  const hadSitting = !!localStorage.getItem(`ielts-reading:v2:${user.uid}:${readingState.testId}`);

  let data;
  try {
    data = await fetchTest(deps, readingState.testId, hadSitting);
  } catch {
    showLoadError("The test could not be loaded. Check the internet connection and refresh the page.");
    return;
  }
  if (!data) {
    showLoadError("This test could not be found.");
    return;
  }

  readingState.passages = data.passages || [];
  readingState.parts = numberQuestions(readingState.passages);
  readingState.items = buildItems(readingState.passages);

  const session = loadSession(user.uid, readingState.testId);
  if (session.part >= readingState.parts.length) session.part = 0;

  const submitter = createSubmitter(deps);

  // a sitting already submitted (maybe still waiting for internet) resumes
  // sending instead of reopening the questions
  if (session.finished) {
    document.body.classList.remove("loading");
    submitter.send();
    return;
  }

  if (data.accessPin && !session.pinOk) {
    document.body.classList.remove("loading");
    await waitForPin(data.accessPin);
    session.pinOk = true;
    saveSession();
  }

  start(session, submitter);
}

function start(session, submitter) {
  if (!session.deadline) {
    session.startedAt = Date.now();
    session.deadline = session.startedAt + TEST_DURATION_MS;
    saveSession();
  }
  const zones = {
    passage: document.getElementById("passagePane"),
    questions: document.getElementById("questionPane"),
  };
  const allQIds = readingState.parts.flatMap((p) => p.qIds);
  let stopClock = () => {};
  let shownPart = null;   // nothing drawn yet: there is no scroll position to keep

  const saveScroll = () => {
    if (shownPart === null) return;
    session.scroll[shownPart] = {
      passage: zones.passage.scrollTop,
      questions: zones.questions.scrollTop,
    };
  };

  const markCurrent = () => {
    document.querySelectorAll(".cd-current").forEach((el) => el.classList.remove("cd-current"));
    const el = session.current && questionEl(session.current);
    el?.classList.add("cd-current");
  };

  const showPart = (index, { restoreScroll = true } = {}) => {
    saveScroll();
    session.part = index;
    renderPart(index, zones);
    shownPart = index;
    const pos = session.scroll[index];
    zones.passage.scrollTop = restoreScroll && pos ? pos.passage : 0;
    zones.questions.scrollTop = restoreScroll && pos ? pos.questions : 0;
    if (!session.current || partOfQuestion(readingState.parts, session.current) !== index) {
      session.current = readingState.parts[index].qIds[0] || null;
    }
    saveSession();
    markCurrent();
    updateFooter();
  };

  const goTo = (qId, { focus = true } = {}) => {
    if (!qId) return;
    const part = partOfQuestion(readingState.parts, qId);
    session.current = qId;
    if (part !== session.part) showPart(part, { restoreScroll: false });
    saveSession();
    markCurrent();
    updateFooter();
    const el = questionEl(qId);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (focus) {
        const field =
          el.querySelector(`[data-qid="${qId}"]:not([type="hidden"])`) ||
          el.querySelector(`input[name="${qId}"]:checked, input[name="${qId}"]`) ||
          el.querySelector("input, select, textarea");
        field?.focus({ preventScroll: true });
      }
    }
  };

  const step = (dir) => {
    const i = allQIds.indexOf(session.current);
    const next = allQIds[Math.max(0, Math.min(allQIds.length - 1, (i < 0 ? 0 : i) + dir))];
    goTo(next);
  };

  // the bottom bar
  buildFooter({
    onPart: (index) => {
      if (index === session.part) return;
      showPart(index);
    },
    onQuestion: (qId) => goTo(qId),
  });
  document.getElementById("prevQ").addEventListener("click", () => step(-1));
  document.getElementById("nextQ").addEventListener("click", () => step(1));
  document.getElementById("reviewToggle").addEventListener("change", (e) => {
    const q = session.current;
    if (!q) return;
    session.flags = session.flags.filter((f) => f !== q);
    if (e.target.checked) session.flags.push(q);
    saveSession();
    updateFooter();
  });

  // following the student around the questions
  const track = (e) => {
    const q = qIdFromTarget(e.target);
    if (q && q !== session.current) {
      session.current = q;
      saveSession();
      markCurrent();
      updateFooter();
    }
  };
  zones.questions.addEventListener("focusin", track);
  zones.questions.addEventListener("click", track);
  onAnswerChange((qId) => {
    if (qId && qId !== session.current && allQIds.includes(qId)) {
      session.current = qId;
      markCurrent();
    }
    updateFooter();
  });

  // scroll positions are part of "where I was"
  let scrollTimer = null;
  const onScroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { saveScroll(); saveSession(); }, 250);
  };
  zones.passage.addEventListener("scroll", onScroll, { passive: true });
  zones.questions.addEventListener("scroll", onScroll, { passive: true });

  initMarks({ zones, getPart: () => session.part, onChange: () => {} });
  initChrome();
  applySettings();
  saveOnLeave();

  // finishing
  const finish = async ({ auto = false } = {}) => {
    if (auto) document.getElementById("finishModal").hidden = true;
    if (!auto) {
      const ok = await confirmFinish();
      if (!ok) return;
    }
    stopClock();
    submitter.finish({ auto });
  };
  document.getElementById("finishBtn").addEventListener("click", () => finish());

  // The clock either runs or stands still at the moment it was paused.
  const clockEl = document.getElementById("timeLeft");
  const runClock = () => {
    stopClock();
    stopClock = () => {};
    if (isPaused()) {
      freezeClock({
        el: clockEl,
        remaining: session.deadline - session.pausedAt,
        unlimited: readingState.unlimited,
      });
      return;
    }
    stopClock = startClock({
      el: clockEl,
      getDeadline: () => session.deadline,
      unlimited: readingState.unlimited,
      onExpire: () => finish({ auto: true }),
    });
  };

  if (readingState.isAdmin) {
    initStaffControls({
      onClock: runClock,
      onCleared: () => {
        showPart(session.part, { restoreScroll: false });
        updateFooter();
      },
    });
  }

  showPart(session.part);
  document.body.classList.remove("loading");

  if (!readingState.isAdmin) runClock();   // staff controls start it themselves
}
