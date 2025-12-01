import { listeningState } from "./state.js";
import { saveCurrentHighlights } from "./highlights.js";
import { analyzeTestProgress, isAnswerValid } from "./progress.js";
import { renderSection } from "./render.js";

export function generateQuestionNav() {
  [1, 2, 3, 4].forEach((section) => {
    const container = document.getElementById(`section${section}Numbers`);
    if (!container) return;
    container.innerHTML = "";

    const start = (section - 1) * 10 + 1;
    const end = section * 10;
    for (let i = start; i <= end; i++) {
      const num = document.createElement("div");
      num.className = "nav-number";
      num.textContent = i;
      num.onclick = () => jumpToQuestion(i);
      container.appendChild(num);
    }
  });
}

export function updateQuestionNav() {
  document.querySelectorAll(".nav-number").forEach((num, index) => {
    const qId = `q${index + 1}`;
    const questionNumber = index + 1;
    const isAnswered = isAnswerValid(listeningState.answersSoFar[qId]);

    num.className = "nav-number";

    if (questionNumber === listeningState.currentQuestionNumber) {
      num.style.background = "#3b82f6";
      num.style.color = "white";
      num.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.3)";
    } else if (isAnswered) {
      num.style.background = "#10b981";
      num.style.color = "white";
      num.style.boxShadow = "none";
    } else {
      num.style.background = "#e5e7eb";
      num.style.color = "#6b7280";
      num.style.boxShadow = "none";
    }
  });
  updateSectionIndicator();
}

export function jumpToQuestion(questionNum) {
  const targetSection = Math.floor((questionNum - 1) / 10);
  const shouldRender = targetSection !== listeningState.currentSectionIndex;

  if (shouldRender) {
    saveCurrentHighlights();
  }

  listeningState.currentQuestionNumber = questionNum;

  if (shouldRender) {
    listeningState.currentSectionIndex = targetSection;
    renderSection(listeningState.currentSectionIndex);
  }
  updateQuestionNav();

  setTimeout(
    () => {
      const el = document.getElementById(`q${questionNum}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    shouldRender ? 200 : 0
  );
}

export function updateSectionIndicator() {
  const indicator = document.getElementById("sectionIndicator");
  if (!indicator) return;

  const progress = analyzeTestProgress();
  const progressPercent = Math.round((progress.answered / progress.total) * 100);

  indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span>Section ${listeningState.currentSectionIndex + 1} of ${
    listeningState.sections.length
  }</span>
            <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 8px;">
                <div style="background: linear-gradient(90deg, #10b981, #3b82f6); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
            </div>
            <span style="font-size: 0.9em; color: #6b7280;">${progress.answered}/${
    progress.total
  }</span>
        </div>
    `;
}

export function attachNavButtons() {
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (listeningState.currentSectionIndex < listeningState.sections.length - 1) {
        listeningState.currentSectionIndex++;
        listeningState.currentQuestionNumber =
          listeningState.currentSectionIndex * 10 + 1;
        renderSection(listeningState.currentSectionIndex);
        updateQuestionNav();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  if (backBtn) {
    backBtn.onclick = () => {
      if (listeningState.currentSectionIndex > 0) {
        listeningState.currentSectionIndex--;
        listeningState.currentQuestionNumber =
          listeningState.currentSectionIndex * 10 + 1;
        renderSection(listeningState.currentSectionIndex);
        updateQuestionNav();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  if (finishBtn) {
    // будет привязано в init через handleFinishTest
  }
}

export function updateNavButtons(index) {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const finishBtn = document.getElementById("finishBtn");

  if (backBtn) backBtn.style.display = index > 0 ? "inline-block" : "none";
  if (nextBtn)
    nextBtn.style.display =
      index < listeningState.sections.length - 1 ? "inline-block" : "none";
  if (finishBtn)
    finishBtn.style.display =
      index === listeningState.sections.length - 1 ? "inline-block" : "none";
}

export function setupOpenReview() {
  window.openReview = () => {
    const progress = analyzeTestProgress();
    alert(
      `Progress: ${progress.answered}/${progress.total} questions answered (${Math.round(
        (progress.answered / progress.total) * 100
      )}%)`
    );
  };
}


