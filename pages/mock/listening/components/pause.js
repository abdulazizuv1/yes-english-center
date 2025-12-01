import { listeningState } from "./state.js";

function toggleTestInteraction(enable) {
  const selectors = [
    ".main-content",
    ".bottom-controls",
    ".question-nav",
    ".test-header button",
    "input",
    "select",
    "button:not(.resume-btn)",
  ];

  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      if (el) {
        el.style.pointerEvents = enable ? "auto" : "none";
        if (
          el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.tagName === "BUTTON"
        ) {
          el.disabled = !enable;
        }
      }
    });
  });

  document.body.style.cursor = enable ? "auto" : "wait";
}

function getCurrentRemainingTime() {
  if (!listeningState.timerStartTime) return 40 * 60;
  const elapsed = Math.floor((Date.now() - listeningState.timerStartTime) / 1000);
  return Math.max(0, 40 * 60 - elapsed);
}

export function startTimer(duration, display, onFinish) {
  if (!display) return;
  clearInterval(window[listeningState.timerIntervalKey]);
  listeningState.timerStartTime = Date.now();

  window[listeningState.timerIntervalKey] = setInterval(() => {
    if (listeningState.isPaused) return;

    const elapsed = Math.floor((Date.now() - listeningState.timerStartTime) / 1000);
    const remaining = duration - elapsed;

    if (remaining <= 0) {
      clearInterval(window[listeningState.timerIntervalKey]);
      alert("Time's up! Submitting automatically.");
      if (onFinish) onFinish();
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;

    if (remaining <= 300) display.style.color = "#dc2626";
    if (remaining === 300) alert("5 minutes remaining!");
    if (remaining === 60) alert("1 minute remaining!");

    listeningState.pausedTime = remaining;
  }, 1000);
}

export function setupTogglePause(handleFinish) {
  window.togglePause = function () {
    const pauseBtn = document.getElementById("pauseBtn");
    const pauseModal = document.getElementById("pauseModal");

    if (!listeningState.isPaused) {
      listeningState.isPaused = true;
      clearInterval(window[listeningState.timerIntervalKey]);
      listeningState.pausedTime = getCurrentRemainingTime();
      if (pauseBtn) pauseBtn.textContent = "Resume";
      if (pauseModal) pauseModal.style.display = "flex";

      if (listeningState.currentAudio && !listeningState.currentAudio.paused) {
        listeningState.audioCurrentTime = listeningState.currentAudio.currentTime;
        listeningState.currentAudio.pause();
      }
      toggleTestInteraction(false);
    } else {
      listeningState.isPaused = false;
      if (pauseBtn) pauseBtn.textContent = "Pause";
      if (pauseModal) pauseModal.style.display = "none";

      if (listeningState.currentAudio && listeningState.audioCurrentTime) {
        listeningState.currentAudio.currentTime = listeningState.audioCurrentTime;
        listeningState.currentAudio.play().catch(console.warn);
      }
      toggleTestInteraction(true);
      if (!listeningState.hasUnlimitedTime) {
        startTimer(listeningState.pausedTime, document.getElementById("time"), handleFinish);
      }
    }
  };
}


