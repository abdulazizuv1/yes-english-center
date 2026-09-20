// localStorage persistence of answers/highlights/timer + the Clear button.
import { state } from "./state.js?v=3.2";
import { getCurrentRemainingTime } from "./timer.js?v=3.2";
import { updateQuestionNav } from "./navigation.js?v=3.2";
import { clearAllHighlights } from "./highlights.js?v=3.2";

function loadSavedState() {
  const saved = localStorage.getItem(state.testStorageKey);
  if (saved) {
    const data = JSON.parse(saved);
    state.answersSoFar = data.answers || {};
    // Sittings saved by the old version carry highlights as snapshots of
    // the questions' HTML. They cannot be turned into text positions, so
    // they are left behind; the answers, which matter, come across.
    state.marks = Array.isArray(data.marks) ? data.marks : [];
    state.savedStage = data.currentStage || null;
    state.savedTimerRemaining = data.timerRemaining || null;
  }
}

function saveState() {
  const data = {
    answers: state.answersSoFar,
    marks: state.marks,
    currentStage: state.currentStage,
    timerRemaining: getCurrentRemainingTime(),
    timestamp: Date.now(),
  };
  localStorage.setItem(state.testStorageKey, JSON.stringify(data));
}

// Clear all answers/highlights and reset UI for the full mock test
function clearAllAnswers() {
  if (!confirm('Clear all answers and highlights for this full mock test?')) return;

  state.answersSoFar = {};
  clearAllHighlights();

  try {
    localStorage.removeItem(state.testStorageKey);
  } catch (e) {
    console.warn('Failed to remove full mock storage', e);
  }

  // Clear inputs/selects/radios/checkboxes/textareas
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.tagName === 'INPUT') {
      const t = el.type && el.type.toLowerCase();
      if (t === 'radio' || t === 'checkbox') el.checked = false;
      else el.value = '';
    } else if (el.tagName === 'TEXTAREA') {
      el.value = '';
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    }
  });

  // Update UI/navigation
  try {
    saveState();
  } catch (e) {
    console.warn('saveState failed after clear', e);
  }

  try {
    if (typeof updateQuestionNav === 'function') updateQuestionNav();
  } catch (e) {
    console.warn('updateQuestionNav not available', e);
  }

  alert('All answers and highlights cleared.');
}
// Expose to global scope for the Clear button
window.clearAllAnswers = clearAllAnswers;
export { loadSavedState, saveState };
