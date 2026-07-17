// Question-number nav bar, stage/section indicators and bottom buttons state.
import { state } from "./state.js";
import { renderListeningSection } from "./listening.js";
import { renderReadingPassage, readingPassageOfQuestion } from "./reading.js";

// Question navigation functions
function generateQuestionNav() {
  const questionNav = document.getElementById("questionNav");
  questionNav.innerHTML = "";

  if (state.currentStage === "listening") {
    // Generate listening navigation (4 sections, 10 questions each)
    for (let section = 1; section <= 4; section++) {
      const navSection = document.createElement("div");
      navSection.className = "nav-section";

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = `Section ${section}:`;

      navSection.appendChild(label);

      const navNumbers = document.createElement("div");
      navNumbers.className = "nav-numbers";
      navNumbers.id = `section${section}Numbers`;

      for (let i = (section - 1) * 10 + 1; i <= section * 10; i++) {
        const num = document.createElement("div");
        num.className = "nav-number";
        num.textContent = i;
        num.onclick = () => jumpToQuestion(i);
        navNumbers.appendChild(num);
      }

      navSection.appendChild(navNumbers);
      questionNav.appendChild(navSection);
    }
  } else if (state.currentStage === "reading") {
    // Generate reading navigation dynamically
    let currentStartQ = 1;
    state.stageData.reading.passages.forEach((passage, index) => {
      const navSection = document.createElement("div");
      navSection.className = "nav-section";

      const label = document.createElement("span");
      label.className = "nav-label";
      label.textContent = `Passage ${index + 1}:`;

      navSection.appendChild(label);

      const navNumbers = document.createElement("div");
      navNumbers.className = "nav-numbers";

      // Use the real per-passage count computed in assignReadingQuestionIds
      // (a question-group counts as its inner questions, not as one).
      const qsInPassage = state.readingPassageCounts[index] || 0;

      const endQ = currentStartQ + qsInPassage - 1;

      for (let i = currentStartQ; i <= endQ; i++) {
        const num = document.createElement("div");
        num.className = "nav-number";
        num.textContent = i;
        num.onclick = () => jumpToQuestion(i);
        navNumbers.appendChild(num);
      }
      currentStartQ = endQ + 1;

      navSection.appendChild(navNumbers);
      questionNav.appendChild(navSection);
    });
  } else if (state.currentStage === "writing") {
    // Writing stage - no question navigation needed
    questionNav.style.display = "none";
  }
}

function updateQuestionNav() {
  const allNumbers = document.querySelectorAll(".nav-number");
  allNumbers.forEach((num, index) => {
    num.classList.remove("current", "answered");

    const questionNum = parseInt(num.textContent);
    let qId = "";

    if (state.currentStage === "listening") {
      qId = `q${questionNum}`; // ✅ БЕЗ префикса listening_
    } else if (state.currentStage === "reading") {
      qId = `reading_q${questionNum}`; // reading оставляем как есть
    }

    // Visual improvements
    const isAnswered =
      state.answersSoFar[qId] !== undefined &&
      state.answersSoFar[qId] !== "" &&
      state.answersSoFar[qId] !== null;
    num.style.background = isAnswered ? "#10b981" : "#e5e7eb";
    num.style.color = isAnswered ? "white" : "#6b7280";
    num.style.transform = "scale(1)";
    num.style.boxShadow = "none";

    if (isAnswered) num.classList.add("answered");

    // Current question highlighting
    if (state.currentStage === "listening") {
      if (
        questionNum >= getSectionStartQuestion(state.currentSectionIndex) &&
        questionNum <= getSectionEndQuestion(state.currentSectionIndex)
      ) {
        if (questionNum === state.currentQuestionIndex + 1) {
          num.classList.add("current");
          num.style.background = "#3b82f6";
          num.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.3)";
        }
      }
    }
    num.onmouseenter = function () {
      if (!this.classList.contains("current")) {
        this.style.transform = "scale(1.1)";
      }
    };
    num.onmouseleave = function () {
      this.style.transform = "scale(1)";
    };
  });
}

function getSectionStartQuestion(sectionIndex) {
  return sectionIndex * 10 + 1;
}

function getSectionEndQuestion(sectionIndex) {
  return (sectionIndex + 1) * 10;
}

function jumpToQuestion(questionNum) {
  if (state.currentStage === "listening") {
    // Determine which section contains this question
    let targetSection = Math.floor((questionNum - 1) / 10);

    // Проверяем, нужно ли перерисовывать секцию
    if (state.currentSectionIndex !== targetSection) {
      state.currentSectionIndex = targetSection;
      renderListeningSection(state.currentSectionIndex);
    }
    state.currentQuestionIndex = questionNum - 1;
  } else if (state.currentStage === "reading") {
    // Map the global question number to its passage using the real counts
    // (handles question-groups, which span several numbers under one entry).
    state.currentPassageIndex = readingPassageOfQuestion(questionNum);
    state.currentQuestionIndex = questionNum - 1;
    renderReadingPassage(state.currentPassageIndex);
  }

  updateQuestionNav();
  updateStageIndicator();

  // Scroll to the specific question
  setTimeout(() => {
    let questionElement = document.getElementById(`reading_q${questionNum}`);
    if (!questionElement) {
      // Fallbacks: try to find related controls for this question
      const byRadio = document.querySelector(`input[name="reading_q${questionNum}"]`);
      if (byRadio) {
        // Prefer scrolling the question container if present
        questionElement = byRadio.closest('.question-item') || byRadio;
      } else {
        // Try any element explicitly referencing this question id
        const byData = document.querySelector(`[data-question-id="reading_q${questionNum}"]`);
        if (byData) {
          questionElement = byData.closest('.question-item') || byData;
        }
      }
    }
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}

function updateStageIndicator() {
  const stageIndicator = document.getElementById("stageIndicator");
  const sectionIndicator = document.getElementById("sectionIndicator");

  stageIndicator.textContent = `Stage ${state.currentStageIndex + 1} of 3`;

  if (state.currentStage === "listening") {
    sectionIndicator.textContent = `Section ${state.currentSectionIndex + 1} of 4`;
  } else if (state.currentStage === "reading") {
    sectionIndicator.textContent = `Passage ${state.currentPassageIndex + 1} of 3`;
  } else if (state.currentStage === "writing") {
    sectionIndicator.textContent = `Writing Tasks 1 & 2`;
  }
}

// Navigation functions
function updateNavigationButtons() {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finishStageBtn = document.getElementById("finishStageBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (state.currentStage === "listening") {
    backBtn.style.display = state.currentSectionIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display =
      state.currentSectionIndex < state.stageData.listening.sections.length - 1
        ? "inline-block"
        : "none";
    finishStageBtn.style.display =
      state.currentSectionIndex === state.stageData.listening.sections.length - 1
        ? "inline-block"
        : "none";
    // Обновляем текст кнопки для listening
    if (finishStageBtn) {
      finishStageBtn.textContent = "Finish Listening";
    }
    finishBtn.style.display = "none";
  } else if (state.currentStage === "reading") {
    backBtn.style.display = state.currentPassageIndex > 0 ? "inline-block" : "none";
    nextBtn.style.display =
      state.currentPassageIndex < state.stageData.reading.passages.length - 1
        ? "inline-block"
        : "none";
    finishStageBtn.style.display =
      state.currentPassageIndex === state.stageData.reading.passages.length - 1
        ? "inline-block"
        : "none";
    // Обновляем текст кнопки для reading
    if (finishStageBtn) {
      finishStageBtn.textContent = "Finish Reading";
    }
    finishBtn.style.display = "none";
  } else if (state.currentStage === "writing") {
    backBtn.style.display = "none";
    nextBtn.style.display = "none";
    finishStageBtn.style.display = "none";
    finishBtn.style.display = "inline-block";
  }
}
export {
  generateQuestionNav,
  updateQuestionNav,
  updateStageIndicator,
  updateNavigationButtons,
};
