// Pausing the clock: a control only a staff account sees, in the timed
// test. (Staff also get "Clear all" there, see clear.js.)
//
// Pausing is written into the sitting like everything else, so it survives
// a refresh, a closed tab and a dead connection: the test comes back
// paused, with the same time left, because the clock counts to a deadline
// and a pause simply moves that deadline later by however long the test
// stood still.
import { readingState } from "./state.js?v=3.3";
import { saveSession } from "./session.js?v=3.3";
import { formatRemaining } from "./timer.js?v=3.3";

export const isPaused = () => !!readingState.session?.pausedAt;

/** onClock — re-read the pause state and start or freeze the clock */
export function initStaffControls({ onClock }) {
  const pauseBtn = document.getElementById("pauseBtn");
  const modal = document.getElementById("pausedModal");
  const resumeBtn = document.getElementById("resumeBtn");
  const label = pauseBtn.querySelector("[data-pause=label]");
  const left = modal.querySelector("[data-paused=left]");

  pauseBtn.hidden = false;

  const reflect = () => {
    const s = readingState.session;
    const paused = !!s?.pausedAt;
    document.body.classList.toggle("paused", paused);
    modal.hidden = !paused;
    label.textContent = paused ? "Resume" : "Pause";
    if (paused) {
      left.textContent = readingState.unlimited
        ? "This account sits the test untimed."
        : `${formatRemaining(s.deadline - s.pausedAt)} when the test restarts.`;
      resumeBtn.focus();
    }
    onClock();
  };

  const pause = () => {
    const s = readingState.session;
    if (!s || s.pausedAt) return;
    s.pausedAt = Date.now();
    saveSession();
    reflect();
  };

  const resume = () => {
    const s = readingState.session;
    if (!s || !s.pausedAt) return;
    // the clock owes back every moment the test stood still, including
    // the time the page was closed
    s.deadline += Date.now() - s.pausedAt;
    s.pausedAt = null;
    saveSession();
    reflect();
  };

  pauseBtn.addEventListener("click", () => (isPaused() ? resume() : pause()));
  resumeBtn.addEventListener("click", resume);

  reflect();   // a sitting reopened while paused comes back paused
}
