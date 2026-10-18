// Finishing the test.
//
// The finished result is first written to this computer, then sent. If the
// internet is down it waits here and goes out by itself when the
// connection returns, even after a refresh. Each sitting has one fixed
// result id, so sending twice can never create two results (the old page
// added a new result on every attempt to send), and a second send after a
// silent success is recognised as already done.
import { listeningState } from "./state.js?v=3.4";
import { saveSession, clearSession } from "./session.js?v=3.4";
import { gradeItems } from "../../engine/index.js?v=3.4";
import { answeredMap } from "./questions.js?v=3.4";
import { forgetAll } from "./audioStore.js?v=3.4";

const SEND_TIMEOUT_MS = 15000;
const RETRY_MS = 15000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("timed out"), { code: "timeout" })), ms)
    ),
  ]);
}

/**
 * Same result shape the result page, the dashboard and the daily plan read.
 * A sitting in analyse mode (pause and rewind allowed) also says so, for
 * the teacher.
 */
export function buildPayload() {
  const graded = gradeItems(listeningState.items.flat(), listeningState.session.answers);
  const answers = {};
  const correctAnswers = {};
  graded.rows.forEach((r) => {
    answers[r.id] = r.user ?? null;
    correctAnswers[r.id] = r.expected;
  });
  const u = listeningState.user;
  return {
    userId: u.uid,
    name: u.email || "unknown",
    testId: listeningState.testId,
    score: graded.correct,
    total: graded.total,
    percentage: graded.total ? Math.round((graded.correct / graded.total) * 100) : 0,
    answers,
    correctAnswers,
    completedAt: new Date().toISOString(),
    ...(listeningState.mode === "analyse" ? { mode: "analyse" } : {}),
  };
}

export function createSubmitter({ db, doc, setDoc, getDoc, serverTimestamp }) {
  let sending = false;
  let retryTimer = null;

  const overlay = document.getElementById("sendOverlay");
  const title = overlay.querySelector("[data-send=title]");
  const text = overlay.querySelector("[data-send=text]");
  const retryBtn = overlay.querySelector("[data-send=retry]");

  const show = (state, detail = "") => {
    overlay.hidden = false;
    overlay.dataset.state = state;
    retryBtn.hidden = state === "sending";
    if (state === "sending") {
      title.textContent = "Submitting your answers";
      text.textContent = "Please wait a moment.";
    } else if (state === "offline") {
      title.textContent = "Your answers are saved on this computer";
      text.textContent =
        "There is no internet connection right now. Keep this page open and they will be sent by themselves as soon as it comes back. If the page gets closed, open this test again on this computer and they will be sent then.";
    } else {
      title.textContent = "Your answers could not be sent yet";
      text.textContent = `They are safe on this computer. ${detail}`;
    }
  };

  const done = (attemptId) => {
    clearTimeout(retryTimer);
    clearSession();
    forgetAll(listeningState.tracks.map((t) => t.url));
    // let go of the sitting entirely: the save-before-leaving safety net
    // fires while the page navigates away, and would otherwise write the
    // finished sitting back
    listeningState.session = null;
    window.location.href = `/pages/mock/listening/result/?id=${encodeURIComponent(attemptId)}`;
  };

  const scheduleRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(send, RETRY_MS);
  };

  async function send() {
    const s = listeningState.session;
    if (sending || !s?.finished || !s.payload) return;
    sending = true;
    show("sending");
    const ref = doc(db, "resultsListening", s.attemptId);

    try {
      if (navigator.onLine === false) throw Object.assign(new Error("offline"), { code: "unavailable" });
      await withTimeout(setDoc(ref, { ...s.payload, createdAt: serverTimestamp() }), SEND_TIMEOUT_MS);
      done(s.attemptId);
    } catch (err) {
      if (err?.code === "permission-denied") {
        // an earlier send may have landed without us hearing back: then the
        // result exists and this second write counts as an edit, which a
        // student is not allowed to make
        try {
          const snap = await withTimeout(getDoc(ref), SEND_TIMEOUT_MS);
          if (snap.exists()) { done(s.attemptId); return; }
        } catch { /* fall through to the error screen */ }
        show("error", "Tell your teacher if this keeps happening.");
      } else {
        show("offline");
        scheduleRetry();
      }
    } finally {
      sending = false;
    }
  }

  retryBtn.addEventListener("click", send);
  window.addEventListener("online", () => {
    if (listeningState.session?.finished) send();
  });

  /** Locks in the answers and sends them. `auto` means the time ran out. */
  function finish({ auto = false } = {}) {
    const s = listeningState.session;
    if (s.finished) return send();
    s.payload = buildPayload();
    s.finished = true;
    s.finishedAt = Date.now();
    s.finishedBy = auto ? "time" : "student";
    saveSession();
    return send();
  }

  return { finish, send };
}

/* ───────────── the "are you sure" dialog ───────────── */

export function confirmFinish() {
  const modal = document.getElementById("finishModal");
  const s = listeningState.session;
  const answered = answeredMap(listeningState.items, s.answers);
  const all = listeningState.parts.flatMap((p) => p.qIds);
  const doneCount = all.filter((q) => answered[q]).length;
  const flagged = s.flags.length;

  modal.querySelector("[data-finish=count]").textContent =
    `You have answered ${doneCount} of ${all.length} questions.`;
  const extra = modal.querySelector("[data-finish=extra]");
  const missing = all.length - doneCount;
  const notes = [];
  if (missing) notes.push(`${missing} ${missing === 1 ? "is" : "are"} still unanswered.`);
  if (flagged) notes.push(`${flagged} ${flagged === 1 ? "is" : "are"} marked for review.`);
  extra.textContent = notes.join(" ");
  extra.hidden = !notes.length;

  modal.hidden = false;
  modal.querySelector("[data-finish=back]").focus();

  return new Promise((resolve) => {
    const close = (answer) => {
      modal.hidden = true;
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      resolve(answer);
    };
    const onClick = (e) => {
      const act = e.target.closest("[data-finish]")?.dataset.finish;
      if (act === "back") close(false);
      else if (act === "submit") close(true);
      else if (e.target === modal) close(false);
    };
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
  });
}
