// Starts the listening test and ties the pieces together.
//
// Order matters: the student's saved sitting is loaded before anything is
// drawn, so every answer, highlight, note and review flag is on the page
// from the first frame, on the part they were on. The test document is
// kept on this computer while a sitting is in progress, so a refresh with
// no internet still opens it.
//
// The dashboard opens the test in one of two modes:
//   • the mock (no ?mode): like the real computer-delivered test, an
//     instructions screen with a sound check, then the recording plays once
//     from start to finish while the student moves freely between the four
//     parts, then two minutes to check answers, then the answers go in by
//     themselves. Nobody can pause or rewind.
//   • analyse mode (?mode=analyse): practice. Everyone can pause, rewind
//     and skip ahead; a stopwatch counts the time spent; "Clear all" starts
//     the test again. No time limit.
// Both finish the same way and save the same result.
import { listeningState } from "./state.js?v=3.4";
import { buildParts, buildTracks, partOfQuestion } from "./questions.js?v=3.4";
import { loadSession, saveSession, saveOnLeave, sessionKey } from "./session.js?v=3.4";
import { renderPart, questionEl, qIdFromTarget } from "./render.js?v=3.4";
import { buildFooter, updateFooter, markPlayingPart } from "./nav.js?v=3.4";
import { initMarks } from "./marks.js?v=3.4";
import { startClock, startStopwatch } from "./timer.js?v=3.4";
import {
  createPlayer, measureTracks, playTestTone, lengthsKnown,
  remaining, recordingLength, recordingOver, started, CHECK_MS,
} from "./audio.js?v=3.4";
import { storeAll } from "./audioStore.js?v=3.4";
import { createSubmitter, confirmFinish } from "./submit.js?v=3.4";
import { initChrome, applySettings, initVolume, banner } from "./chrome.js?v=3.4";
import { onAnswerChange } from "./engineCtx.js?v=3.4";
import { initPlayerControls } from "./controls.js?v=3.4";
import { initClear } from "./clear.js?v=3.4";

// staff who sit tests without a clock
const UNTIMED = new Set(["alisher@yescenter.uz"]);
const TEST_CACHE = (testId) => `ielts-listening:v2:test:${testId}`;
const ROLE_CACHE = (uid) => `ielts-listening:v2:role:${uid}`;
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
      deps.getDoc(deps.doc(deps.db, "listeningTests", testId)),
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

export async function initListeningTest(deps) {
  const { auth, onAuthStateChanged } = deps;
  document.body.classList.add("loading");

  // signing in is remembered on this computer, so this works offline too
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { unsub(); resolve(u); });
  });
  if (!user) {
    alert("You must be logged in to take the listening test.");
    window.location.href = "/";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  listeningState.testId = params.get("testId") || "test-1";
  listeningState.mode = params.get("mode") === "analyse" ? "analyse" : "mock";
  listeningState.user = { uid: user.uid, email: user.email || "" };
  listeningState.unlimited = UNTIMED.has(user.email);
  listeningState.isAdmin = await isAdminAccount(deps, user.uid);
  document.getElementById("candidate").textContent = user.email || "Candidate";
  if (listeningState.mode === "analyse") {
    document.body.classList.add("analyse");
    document.getElementById("modeTag").hidden = false;
  }

  let hadSitting = false;
  try { hadSitting = !!localStorage.getItem(sessionKey(user.uid, listeningState.testId)); } catch { /* no storage */ }

  let data;
  try {
    data = await fetchTest(deps, listeningState.testId, hadSitting);
  } catch {
    showLoadError("The test could not be loaded. Check the internet connection and refresh the page.");
    return;
  }
  if (!data) {
    showLoadError("This test could not be found.");
    return;
  }

  const sections = data.sections || data.parts?.sections || (Array.isArray(data.parts) ? data.parts : []);
  if (!sections.length) {
    showLoadError("This test has no questions yet.");
    return;
  }
  listeningState.title = data.title || data.parts?.title || "Listening";
  document.title = listeningState.mode === "analyse" ? "IELTS Listening · Analyse mode" : "IELTS Listening";
  listeningState.sections = sections;
  const { items, parts } = buildParts(sections);
  listeningState.items = items;
  listeningState.parts = parts;
  listeningState.tracks = buildTracks(sections);

  const session = loadSession(user.uid, listeningState.testId);
  if (session.part >= parts.length) session.part = 0;

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
  const zone = document.getElementById("questionPane");
  const allQIds = listeningState.parts.flatMap((p) => p.qIds);
  let shownPart = null;   // nothing drawn yet: there is no scroll position to keep

  const saveScroll = () => {
    if (shownPart === null) return;
    session.scroll[shownPart] = zone.scrollTop;
  };

  const markCurrent = () => {
    document.querySelectorAll(".cd-current").forEach((el) => el.classList.remove("cd-current"));
    const el = session.current && questionEl(session.current);
    el?.classList.add("cd-current");
  };

  const showPart = (index, { restoreScroll = true } = {}) => {
    saveScroll();
    session.part = index;
    renderPart(index, zone);
    shownPart = index;
    const pos = session.scroll[index];
    zone.scrollTop = restoreScroll && typeof pos === "number" ? pos : 0;
    if (!session.current || partOfQuestion(listeningState.parts, session.current) !== index) {
      session.current = listeningState.parts[index].qIds[0] || null;
    }
    saveSession();
    markCurrent();
    updateFooter();
  };

  const goTo = (qId, { focus = true } = {}) => {
    if (!qId) return;
    const part = partOfQuestion(listeningState.parts, qId);
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
    onPart: (index) => { if (index !== session.part) showPart(index); },
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
  zone.addEventListener("focusin", track);
  zone.addEventListener("click", track);
  onAnswerChange((qId) => {
    if (qId && qId !== session.current && allQIds.includes(qId)) {
      session.current = qId;
      markCurrent();
    }
    updateFooter();
  });

  // the scroll position is part of "where I was"
  let scrollTimer = null;
  zone.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { saveScroll(); saveSession(); }, 250);
  }, { passive: true });

  const marksUi = initMarks({ zones: { questions: zone }, getPart: () => session.part, onChange: () => {} });
  initChrome();
  applySettings();
  saveOnLeave();

  /* ── the recording ── */
  const analyse = listeningState.mode === "analyse";
  let controls = null;
  let stopClock = () => {};
  let paintClock = () => {};
  const checking = () => {
    let text = "";
    if (recordingOver()) {
      text = analyse
        ? "The recording has finished. Move it back to listen again, or click ✓ when you are done."
        : `The recording has finished. You have ${Math.round(CHECK_MS / 60000)} minutes to check your answers.`;
    }
    banner("check", text, "info");
  };
  const resumeModal = document.getElementById("resumeModal");
  const player = createPlayer({
    // when a part's recording begins, its questions come up, as the
    // narrator turns the candidate to the next part
    onPartStart: (part) => { if (part !== session.part) showPart(part, { restoreScroll: false }); },
    onDone: checking,
    onBlocked: (isBlocked) => {
      resumeModal.hidden = !isBlocked;
      if (isBlocked) document.getElementById("continueBtn").focus();
    },
    onChange: () => {
      markPlayingPart(player.playingPart());
      controls?.update();
      paintClock();
      checking();
    },
  });
  document.getElementById("continueBtn").addEventListener("click", () => {
    resumeModal.hidden = true;
    player.unblock();
  });
  initVolume({ onVolume: (v) => player.setVolume(v) });

  // keep the recording on this computer, quietly, while the test runs
  const storeRecording = (onProgress) => storeAll(listeningState.tracks.map((t) => t.url), onProgress);

  /* ── finishing ── */
  const finish = async ({ auto = false } = {}) => {
    if (auto) document.getElementById("finishModal").hidden = true;
    if (!auto) {
      const ok = await confirmFinish();
      if (!ok) return;
    }
    stopClock();
    player.stop();
    submitter.finish({ auto });
  };
  document.getElementById("finishBtn").addEventListener("click", () => finish());

  const clockEl = document.getElementById("timeLeft");
  const runClock = () => {
    stopClock();
    if (analyse) {
      // no time limit: the time spent, standing still while paused
      const watch = startStopwatch({
        el: clockEl,
        getElapsed: () => session.elapsed || 0,
        isPaused: () => !!session.paused,
      });
      stopClock = watch;
      paintClock = watch.paint;
      return;
    }
    stopClock = startClock({
      el: clockEl,
      getRemaining: () => (lengthsKnown() ? remaining() : null),
      unlimited: listeningState.unlimited,
      onExpire: () => finish({ auto: true }),
    });
  };

  /* ── pause, rewind and clear ── */
  const redrawCleared = () => {
    marksUi?.closeMenu();
    marksUi?.closeNote();
    showPart(session.part, { restoreScroll: false });
    updateFooter();
  };
  if (analyse) {
    // everyone: pause and move the recording; clear starts the test again
    controls = initPlayerControls({ player, onPause: () => { paintClock(); checking(); } });
    initClear({
      resetsClock: true,
      onCleared: () => { player.reset(); session.part = 0; redrawCleared(); },
    });
  } else if (listeningState.isAdmin) {
    // the mock is the exam: nobody pauses or rewinds it; staff may still
    // empty a sitting to check a test again
    initClear({ onCleared: redrawCleared });
  }

  showPart(session.part);
  document.body.classList.remove("loading");

  if (!started()) {
    showIntro({ player, storeRecording, onStart: () => { runClock(); } });
    return;
  }

  // picking up a sitting: the mock's recording carries on from where it is
  // by now; analyse mode's from where it was left
  if (!analyse && !listeningState.unlimited && lengthsKnown() && remaining() <= 0) {
    finish({ auto: true });
    return;
  }
  runClock();
  checking();
  player.run();
  storeRecording();
}

/* ─────────────────── before the test: instructions and sound check ─────────────────── */

function showIntro({ player, storeRecording, onStart }) {
  const modal = document.getElementById("introModal");
  const startBtn = document.getElementById("startBtn");
  const timeEl = modal.querySelector("[data-intro=time]");
  const statusEl = modal.querySelector("[data-intro=status]");
  const titleEl = modal.querySelector("[data-intro=title]");
  const countEl = modal.querySelector("[data-intro=count]");
  const partsEl = modal.querySelector("[data-intro=parts]");
  const savedEl = modal.querySelector("[data-intro=saved]");

  const total = listeningState.parts.reduce((n, p) => n + p.qIds.length, 0);
  titleEl.textContent = listeningState.title;
  countEl.textContent = String(total);
  partsEl.textContent = String(listeningState.parts.length);
  modal.hidden = false;
  document.body.classList.add("intro-open");

  startBtn.disabled = true;
  statusEl.textContent = "Preparing the recording…";
  let ready = false;
  const enable = (known) => {
    if (ready) return;
    ready = true;
    const analyse = listeningState.mode === "analyse";
    const mins = known ? Math.round((recordingLength() + (analyse ? 0 : CHECK_MS)) / 60000) : null;
    const minutes = (n) => `${n} ${n === 1 ? "minute" : "minutes"}`;
    timeEl.textContent = analyse
      ? (mins ? `no time limit (the recording lasts about ${minutes(mins)})` : "no time limit")
      : (mins ? `approximately ${minutes(mins)}` : "approximately 30 minutes");
    statusEl.textContent = "";
    startBtn.disabled = false;
    startBtn.focus();
  };
  if (!listeningState.tracks.length) {
    statusEl.textContent = "This test has no recording yet. Tell your teacher.";
    return;
  }
  measureTracks().then(enable);
  setTimeout(() => enable(false), 25000);   // a file that will not answer does not hold the test up

  storeRecording((done, of) => {
    if (done === of) savedEl.hidden = false;
  });

  document.getElementById("soundCheck").addEventListener("click", () => {
    playTestTone(listeningState.session.volume ?? 0.8);
  });

  startBtn.addEventListener("click", () => {
    const s = listeningState.session;
    if (started()) return;
    s.startedAt = Date.now();
    if (listeningState.mode === "analyse") {
      s.pos = 0;
      s.paused = false;
    } else {
      s.anchor = s.startedAt;
    }
    saveSession();
    modal.hidden = true;
    document.body.classList.remove("intro-open");
    onStart();
    player.run();          // inside the click, so the browser lets it play
  }, { once: true });
}
