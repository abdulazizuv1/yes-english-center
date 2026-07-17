// Stage countdown timer and the listening Pause button.
import { state, stageDurations } from "./state.js";
import { showStageTransition } from "./stages.js";
import { handleFinishTest } from "./results.js";

// Pause functionality
window.togglePause = function () {
  if (state.currentStage !== "listening") return;

  const pauseBtn = document.getElementById("pauseBtn");
  const pauseModal = document.getElementById("pauseModal");

  if (!state.isPaused) {
    state.isPaused = true;
    clearInterval(window.fullMockTimerInterval);
    state.pausedTime = getCurrentRemainingTime();
    if (pauseBtn) pauseBtn.textContent = "Resume";
    if (pauseModal) pauseModal.style.display = "flex";

    if (state.currentAudio && !state.currentAudio.paused) {
      state.audioCurrentTime = state.currentAudio.currentTime;
      state.currentAudio.pause();
    }
    toggleTestInteraction(false);
  } else {
    state.isPaused = false;
    if (pauseBtn) pauseBtn.textContent = "Pause";
    if (pauseModal) pauseModal.style.display = "none";

    if (state.currentAudio && state.audioCurrentTime) {
      state.currentAudio.currentTime = state.audioCurrentTime;
      state.currentAudio.play().catch(console.warn);
    }
    toggleTestInteraction(true);
    // Only resume timer if user doesn't have unlimited time
    if (!state.hasUnlimitedTime) {
      startTimer(state.pausedTime, document.getElementById("time"));
    }
  }
};

function toggleTestInteraction(enable) {
  [".main-content", ".bottom-controls", ".question-nav"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (el) el.style.pointerEvents = enable ? "auto" : "none";
  });
}

function getCurrentRemainingTime() {
  if (!state.timerStartTime) return stageDurations[state.currentStage] * 60;
  const elapsed = Math.floor((Date.now() - state.timerStartTime) / 1000);
  return Math.max(0, stageDurations[state.currentStage] * 60 - elapsed);
}

// Timer function
function startTimer(durationInSeconds, display) {
  clearInterval(window.fullMockTimerInterval);
  state.timerStartTime = Date.now();

  window.fullMockTimerInterval = setInterval(() => {
    if (state.isPaused && state.currentStage === "listening") return;

    const elapsed = Math.floor((Date.now() - state.timerStartTime) / 1000);
    const remaining = durationInSeconds - elapsed;

    if (remaining <= 0) {
      clearInterval(window.fullMockTimerInterval);
      alert("Time's up for this stage!");

      if (state.currentStage === "listening") {
        showStageTransition("listening", "reading");
      } else if (state.currentStage === "reading") {
        showStageTransition("reading", "writing");
      } else if (state.currentStage === "writing") {
        handleFinishTest();
      }
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;

    if (remaining <= 300) display.style.color = "#dc2626";
    if (remaining === 300) alert("5 minutes remaining!");

    state.pausedTime = remaining;
  }, 1000);
}
export { startTimer, getCurrentRemainingTime };
