import { readingState } from "./state.js";

export function createPauseModal() {
  const modal = document.createElement("div");
  modal.className = "pause-modal";
  modal.id = "pauseModal";
  modal.innerHTML = `
       <div class="pause-modal-content">
           <h2>Reading Test Paused</h2>
           <p>Your test has been paused. Click resume when you're ready to continue.</p>
           <button class="resume-btn" onclick="togglePause()">Resume Test</button>
       </div>
   `;
  document.body.appendChild(modal);
}

export function setupTogglePause(startTimerWithFinish) {
  window.togglePause = function () {
    const pauseBtn = document.getElementById("pauseBtn");
    const pauseModal = document.getElementById("pauseModal");

    if (!readingState.isPaused) {
      readingState.isPaused = true;
      clearInterval(window.readingTimerInterval);
      pauseBtn.textContent = "Resume";
      pauseBtn.classList.add("paused");
      pauseModal.style.display = "flex";

      document.querySelector(".passage-panel").style.pointerEvents = "none";
      document.querySelector(".questions-panel").style.pointerEvents = "none";
      document.querySelector(".bottom-controls").style.pointerEvents = "none";
      document.querySelector(".question-nav").style.pointerEvents = "none";
    } else {
      readingState.isPaused = false;
      pauseBtn.textContent = "Pause";
      pauseBtn.classList.remove("paused");
      pauseModal.style.display = "none";

      document.querySelector(".passage-panel").style.pointerEvents = "auto";
      document.querySelector(".questions-panel").style.pointerEvents = "auto";
      document.querySelector(".bottom-controls").style.pointerEvents = "auto";
      document.querySelector(".question-nav").style.pointerEvents = "auto";

      const display = document.getElementById("time");
      if (!readingState.hasUnlimitedTime) {
        startTimerWithFinish(readingState.pausedTime, display);
      }
    }
  };
}


