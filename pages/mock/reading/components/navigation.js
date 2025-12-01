import { readingState } from "./state.js";
import { saveCurrentHighlights } from "./highlights.js";

let renderPassageFnGlobal = null;

export function setRenderPassageFn(fn) {
  renderPassageFnGlobal = fn;
}

export function generateQuestionNav() {
  const part1 = document.getElementById("part1Numbers");
  const part2 = document.getElementById("part2Numbers");
  const part3 = document.getElementById("part3Numbers");

  for (let i = 1; i <= 13; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i, renderPassageFnGlobal);
    part1.appendChild(num);
  }

  for (let i = 14; i <= 26; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i, renderPassageFnGlobal);
    part2.appendChild(num);
  }

  for (let i = 27; i <= 40; i++) {
    const num = document.createElement("div");
    num.className = "nav-number";
    num.textContent = i;
    num.onclick = () => jumpToQuestion(i, renderPassageFnGlobal);
    part3.appendChild(num);
  }
}

export function updateQuestionNav() {
  const allNumbers = document.querySelectorAll(".nav-number");
  allNumbers.forEach((num, index) => {
    num.classList.remove("current", "answered");

    const qId = `q${index + 1}`;
    if (readingState.answersSoFar[qId] && readingState.answersSoFar[qId].trim() !== "") {
      num.classList.add("answered");
    }

    if (
      index + 1 >= getPassageStartQuestion(readingState.currentPassageIndex) &&
      index + 1 <= getPassageEndQuestion(readingState.currentPassageIndex)
    ) {
      if (index === readingState.currentQuestionIndex) {
        num.classList.add("current");
      }
    }
  });
}

export function getPassageStartQuestion(passageIndex) {
  if (passageIndex === 0) return 1;
  if (passageIndex === 1) return 14;
  if (passageIndex === 2) return 27;
  return 1;
}

export function getPassageEndQuestion(passageIndex) {
  if (passageIndex === 0) return 13;
  if (passageIndex === 1) return 26;
  if (passageIndex === 2) return 40;
  return 13;
}

export function attachPassageNavButtons() {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");

  backBtn.addEventListener("click", () => {
    if (readingState.currentPassageIndex > 0) {
      saveCurrentHighlights(() => {});
      readingState.currentPassageIndex--;
      if (renderPassageFnGlobal) {
        renderPassageFnGlobal(readingState.currentPassageIndex);
        updateQuestionNav();
      }
    }
  });

  nextBtn.addEventListener("click", () => {
    if (readingState.currentPassageIndex < readingState.passages.length - 1) {
      saveCurrentHighlights(() => {});
      readingState.currentPassageIndex++;
      if (renderPassageFnGlobal) {
        renderPassageFnGlobal(readingState.currentPassageIndex);
        updateQuestionNav();
      }
    }
  });
}

export function startTimer(durationInSeconds, display, handleFinish) {
  clearInterval(window.readingTimerInterval);

  const startTime = Date.now();
  readingState.pausedTime = durationInSeconds;

  window.readingTimerInterval = setInterval(() => {
    if (readingState.isPaused) return;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = durationInSeconds - elapsed;
    readingState.pausedTime = remaining;

    if (remaining <= 0) {
      clearInterval(window.readingTimerInterval);
      alert("Time's up!");
      handleFinish();
      return;
    }

    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    display.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

export function jumpToQuestion(questionNum, renderPassageFn) {
  saveCurrentHighlights(() => {});

  let targetPassage = 0;
  if (questionNum >= 14 && questionNum <= 26) targetPassage = 1;
  else if (questionNum >= 27) targetPassage = 2;

  readingState.currentPassageIndex = targetPassage;
  readingState.currentQuestionIndex = questionNum - 1;

  const renderFn = renderPassageFn || renderPassageFnGlobal;
  if (renderFn) {
    renderFn(readingState.currentPassageIndex);
    updateQuestionNav();
  }

  setTimeout(() => {
    let questionElement = document.getElementById(`q${questionNum}`);
    if (!questionElement) {
      const byRadio = document.querySelector(`input[name="q${questionNum}"]`);
      if (byRadio) {
        questionElement = byRadio.closest(".question-item") || byRadio;
      } else {
        const byData = document.querySelector(`[data-question-id="q${questionNum}"]`);
        if (byData) {
          questionElement = byData.closest(".question-item") || byData;
        }
      }
    }
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, 100);
}


