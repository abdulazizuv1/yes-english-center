// The listening test's bridge to the shared question engine: answers live
// on listeningState.answersSoFar; every change persists and refreshes nav.
import { listeningState } from "./state.js";
import { updateQuestionNav } from "./navigation.js";

export const engineCtx = {
  get answers() {
    return listeningState.answersSoFar;
  },
  onAnswer(qId, value) {
    if (!qId) return;
    if (value === undefined) delete listeningState.answersSoFar[qId];
    else listeningState.answersSoFar[qId] = value;
    try {
      localStorage.setItem(
        "listeningTestAnswers",
        JSON.stringify(listeningState.answersSoFar)
      );
    } catch (e) {
      console.warn("Failed to persist listening answers", e);
    }
    updateQuestionNav();
  },
};
