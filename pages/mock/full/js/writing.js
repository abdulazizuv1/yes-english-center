// Writing stage: task rendering, word counts, local draft persistence.
import { state } from "./state.js";
import { updateNavigationButtons } from "./navigation.js";

// Initialize Writing
function initializeWriting() {
  const writingTasks = state.stageData.writing.tasks[0]; // Assuming first test
  
  // Backward compatibility for newly added tests that used the array format
  let task1Data = writingTasks.task1;
  let task2Data = writingTasks.task2;
  
  if (!task1Data && state.stageData.writing.tasks.length >= 2 && state.stageData.writing.tasks[0].instructions) {
    task1Data = {
       question: `${state.stageData.writing.tasks[0].instructions}\n\n${state.stageData.writing.tasks[0].prompt}`,
       imageUrl: state.stageData.writing.tasks[0].imageUrl
    };
    task2Data = {
       question: `${state.stageData.writing.tasks[1].instructions}\n\n${state.stageData.writing.tasks[1].topic || ''}\n\n${state.stageData.writing.tasks[1].prompt}`
    };
  }

  // Render Task 1
  document.getElementById("task1Question").textContent =
    task1Data.question;
  if (task1Data.imageUrl) {
    document.getElementById("task1Image").innerHTML = `
      <img src="${task1Data.imageUrl}" alt="Task 1 Image" style="max-width: 100%; height: auto; border-radius: 8px;">
    `;
  }

  // Render Task 2
  document.getElementById("task2Question").textContent =
    task2Data.question;

  // Set up word count functionality
  setupWordCount("task1Answer", "task1WordCount");
  setupWordCount("task2Answer", "task2WordCount");
  // Restore saved writing answers
  const savedTask1 = localStorage.getItem("fullmock_task1Answer");
  const savedTask2 = localStorage.getItem("fullmock_task2Answer");

  if (savedTask1) {
    document.getElementById("task1Answer").value = savedTask1;
    state.answersSoFar["task1Answer"] = savedTask1;
  }

  if (savedTask2) {
    document.getElementById("task2Answer").value = savedTask2;
    state.answersSoFar["task2Answer"] = savedTask2;
  }

  updateNavigationButtons();
}

function setupWordCount(textareaId, counterId) {
  const textarea = document.getElementById(textareaId);
  const counter = document.getElementById(counterId);

  // Load existing answer if any
  if (state.answersSoFar[textareaId]) {
    textarea.value = state.answersSoFar[textareaId];
  }

  function updateWordCount() {
    const text = textarea.value.trim();
    const wordCount = text === "" ? 0 : text.split(/\s+/).length;
    counter.textContent = wordCount;

    // Save answer В ОБЪЕКТ state.answersSoFar И в локальное хранилище
    state.answersSoFar[textareaId] = textarea.value;
    localStorage.setItem(`fullmock_${textareaId}`, textarea.value);
  }

  textarea.addEventListener("input", updateWordCount);
  updateWordCount(); // Initial count
}
export { initializeWriting };
