// Stage lifecycle: switching between listening/reading/writing, timers,
// stage transition modal and the bottom navigation buttons.
import { state, stageNames, stageDurations } from "./state.js";
import { auth, onAuthStateChanged } from "./firebase.js";
import { stopAllAudio } from "./audio.js";
import { startTimer } from "./timer.js";
import { initializeListening, renderListeningSection } from "./listening.js";
import { initializeReading, renderReadingPassage } from "./reading.js";
import { initializeWriting } from "./writing.js";
import {
  generateQuestionNav,
  updateQuestionNav,
  updateStageIndicator,
} from "./navigation.js";
import { handleFinishTest } from "./results.js";

// Initialize stage
function initializeStage(stageName) {
  stopAllAudio();

  state.currentStage = stageName;
  state.currentStageIndex = stageNames.indexOf(stageName);

  // Update UI
  updateStageTitle();
  showStageContent(stageName);
  updateStageIndicator();

  // Check if user has unlimited time before starting timer
  onAuthStateChanged(auth, (user) => {
    const display = document.getElementById("time");
    if (user && user.email === "alisher@yescenter.uz") {
      // Unlimited time for this account
      state.hasUnlimitedTime = true;
      display.textContent = "∞";
      display.style.fontSize = "24px";
    } else {
      // Normal timer for other users
      state.hasUnlimitedTime = false;
      const defaultDuration = stageDurations[stageName] * 60;
      
      // Use saved timer if we're restoring the specific stage we saved
      if (state.savedStage === stageName && state.savedTimerRemaining !== null) {
        startTimer(state.savedTimerRemaining, display);
        // Clear it so it only applies once
        state.savedTimerRemaining = null;
      } else {
        startTimer(defaultDuration, display);
      }
    }
  });

  // Initialize stage-specific content BEFORE building the question nav:
  // reading nav cell counts come from state.readingPassageCounts, which is only
  // filled by assignReadingQuestionIds() inside initializeReading().
  if (stageName === "listening") {
    initializeListening();
  } else if (stageName === "reading") {
    initializeReading();
  } else if (stageName === "writing") {
    initializeWriting();
  }

  generateQuestionNav();
  updateQuestionNav();
}

function updateStageTitle() {
  const testTitle = document.getElementById("testTitle");
  const stageNames = {
    listening: "IELTS Full Mock Test - Listening",
    reading: "IELTS Full Mock Test - Reading",
    writing: "IELTS Full Mock Test - Writing",
  };
  testTitle.textContent = stageNames[state.currentStage];
}

function showStageContent(stageName) {
  // Hide all stage contents
  document.getElementById("listeningStage").style.display = "none";
  document.getElementById("readingStage").style.display = "none";
  document.getElementById("writingStage").style.display = "none";

  // Show current stage
  document.getElementById(`${stageName}Stage`).style.display = "flex";

  // Show/hide question navigation
  const questionNav = document.getElementById("questionNav");
  if (stageName === "writing") {
    questionNav.style.display = "none";
  } else {
    questionNav.style.display = "flex";
  }
}

// Stage transition
function showStageTransition(fromStage, toStage) {
  const modal = document.getElementById("stageTransitionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");

  const stageNames = {
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
  };

  modalTitle.textContent = `${stageNames[fromStage]} Complete!`;
  modalMessage.textContent = `You have completed the ${fromStage} section. Ready to start ${toStage}?`;

  modal.style.display = "flex";

  document.getElementById("continueToNextStage").onclick = () => {
    modal.style.display = "none";
    clearInterval(window.fullMockTimerInterval);
    stopAllAudio();
    initializeStage(toStage);
  };
}

// Bottom navigation buttons (runs once from the entry).
function setupStageControls() {
// Navigation button handlers
document.getElementById("nextBtn").onclick = () => {
  if (state.currentStage === "listening") {
    if (state.currentSectionIndex < state.stageData.listening.sections.length - 1) {
      state.currentSectionIndex++;
      renderListeningSection(state.currentSectionIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  } else if (state.currentStage === "reading") {
    if (state.currentPassageIndex < state.stageData.reading.passages.length - 1) {
      state.currentPassageIndex++;
      renderReadingPassage(state.currentPassageIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  }
};

document.getElementById("backBtn").onclick = () => {
  if (state.currentStage === "listening") {
    if (state.currentSectionIndex > 0) {
      state.currentSectionIndex--;
      renderListeningSection(state.currentSectionIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  } else if (state.currentStage === "reading") {
    if (state.currentPassageIndex > 0) {
      state.currentPassageIndex--;
      renderReadingPassage(state.currentPassageIndex);
      updateQuestionNav();
      updateStageIndicator();
    }
  }
};

document.getElementById("finishStageBtn").onclick = () => {
  if (state.currentStage === "listening") {
    showStageTransition("listening", "reading");
  } else if (state.currentStage === "reading") {
    showStageTransition("reading", "writing");
  }
};

document.getElementById("finishBtn").onclick = async () => {
  // Disable finish button to prevent multiple clicks
  const finishBtn = document.getElementById("finishBtn");
  finishBtn.disabled = true;
  finishBtn.textContent = "Submitting...";

  // Show loading modal
  const loadingModal = document.getElementById("loadingModal");
  loadingModal.style.display = "flex";

  try {
    await handleFinishTest();
  } catch (error) {
    // Hide loading modal and restore button on error
    loadingModal.style.display = "none";
    finishBtn.disabled = false;
    finishBtn.textContent = "Finish Test";
    console.error("Error in handleFinishTest:", error);
  }
};
}

export { initializeStage, showStageTransition, setupStageControls };
