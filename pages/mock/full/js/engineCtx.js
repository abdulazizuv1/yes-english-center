// The full mock's bridge to the shared question engine: answers live on
// state.answersSoFar; every change persists and refreshes the nav.
import { state } from "./state.js";
import { saveState } from "./storage.js";
import { updateQuestionNav } from "./navigation.js";

export const engineCtx = {
  get answers() {
    return state.answersSoFar;
  },
  onAnswer(qId, value) {
    if (!qId) return;
    if (value === undefined) delete state.answersSoFar[qId];
    else state.answersSoFar[qId] = value;
    saveState();
    updateQuestionNav();
  },
};
