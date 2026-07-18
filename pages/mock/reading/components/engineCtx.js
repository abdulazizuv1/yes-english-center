// The reading test's bridge to the shared question engine: answers live
// on readingState.answersSoFar; every change persists and refreshes nav.
import { readingState } from "./state.js";
import { saveState } from "./storage.js";
import { updateQuestionNav } from "./navigation.js";

export const engineCtx = {
  get answers() {
    return readingState.answersSoFar;
  },
  onAnswer(qId, value) {
    if (!qId) return;
    if (value === undefined) delete readingState.answersSoFar[qId];
    else readingState.answersSoFar[qId] = value;
    saveState();
    updateQuestionNav();
  },
};
