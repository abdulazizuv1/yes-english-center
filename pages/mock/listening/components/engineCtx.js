// The listening test's bridge to the shared question engine. Answers live
// in the saved session; every change is written to this computer at once
// and the bottom bar is told to refresh.
import { listeningState } from "./state.js?v=3.4";
import { saveSession } from "./session.js?v=3.4";

const listeners = new Set();
export const onAnswerChange = (fn) => listeners.add(fn);

export const engineCtx = {
  get answers() {
    return listeningState.session.answers;
  },
  onAnswer(qId, value) {
    if (!qId) return;
    const answers = listeningState.session.answers;
    if (value === undefined || value === null || value === "") delete answers[qId];
    else answers[qId] = value;
    saveSession();
    listeners.forEach((fn) => fn(qId));
  },
};
