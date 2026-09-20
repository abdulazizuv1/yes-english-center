// Controls only a staff account sees: pausing the clock, and clearing the
// sitting back to empty.
//
// Pausing is written into the sitting like everything else, so it survives
// a refresh, a closed tab and a dead connection: the test comes back
// paused, with the same time left, because the clock counts to a deadline
// and a pause simply moves that deadline later by however long the test
// stood still.
import { readingState } from "./state.js?v=3.2";
import { saveSession } from "./session.js?v=3.2";
import { formatRemaining } from "./timer.js?v=3.2";

export const isPaused = () => !!readingState.session?.pausedAt;

/**
 * onClock   — re-read the pause state and start or freeze the clock
 * onCleared — redraw the part after the sitting is emptied
 */
export function initStaffControls({ onClock, onCleared }) {
  const pauseBtn = document.getElementById("pauseBtn");
  const clearBtn = document.getElementById("clearBtn");
  const modal = document.getElementById("pausedModal");
  const resumeBtn = document.getElementById("resumeBtn");
  const label = pauseBtn.querySelector("[data-pause=label]");
  const left = modal.querySelector("[data-paused=left]");

  pauseBtn.hidden = false;
  clearBtn.hidden = false;

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

  clearBtn.addEventListener("click", () => {
    const ok = window.confirm(
      "Clear everything in this test?\n\n" +
      "Every answer, highlight, note and review mark will be deleted from this computer. " +
      "This cannot be undone."
    );
    if (!ok) return;
    const s = readingState.session;
    s.answers = {};
    s.marks = [];
    s.flags = [];
    s.current = null;
    s.scroll = {};
    saveSession();
    onCleared();
    window.alert("The test has been cleared.");
  });

  reflect();   // a sitting reopened while paused comes back paused
}
