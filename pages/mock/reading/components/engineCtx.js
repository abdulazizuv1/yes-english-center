// The reading test's bridge to the shared question engine. Answers live in
// the saved session; every change is written to this computer at once and
// the bottom bar is told to refresh.
import { readingState } from "./state.js";
import { saveSession } from "./session.js";

const listeners = new Set();
export const onAnswerChange = (fn) => listeners.add(fn);

export const engineCtx = {
  get answers() {
    return readingState.session.answers;
  },
  onAnswer(qId, value) {
    if (!qId) return;
    const answers = readingState.session.answers;
    if (value === undefined || value === null || value === "") delete answers[qId];
    else answers[qId] = value;
    saveSession();
    listeners.forEach((fn) => fn(qId));
  },
};
