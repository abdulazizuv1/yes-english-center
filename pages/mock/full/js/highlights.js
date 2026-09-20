// Highlights and notes for the full mock.
//
// The old version remembered a highlight by saving a copy of the
// questions' HTML and pasting that copy back on the next render. The
// pasted controls were plain markup: the engine's listeners were gone,
// its data-qe/data-qid attributes were stripped, and a radio's "checked"
// cannot travel in HTML at all — so a student's multiple-choice answers
// vanished from the screen after a refresh and answers typed afterwards
// went nowhere. That was the lost-answers bug.
//
// Now a highlight is only a position in the text (start and end
// character) and is painted onto the page the engine has just drawn.
// The question DOM is never replaced. The system is shared with the
// standalone reading test — see pages/mock/engine/marks.js.
import { state } from "./state.js?v=3.2";
import { saveState } from "./storage.js?v=3.2";
import { updateQuestionNav } from "./navigation.js?v=3.2";
import { initMarks, paintMarks } from "../../engine/marks.js?v=3.2";

/** Which passage/section the student is on: marks are saved against it. */
export function currentPart() {
  return state.currentStage === "listening"
    ? `l${state.currentSectionIndex}`
    : `r${state.currentPassageIndex}`;
}

/** The panels that can be highlighted in the stage showing right now. */
export function currentZones() {
  if (state.currentStage === "listening") {
    return { questions: document.getElementById("listening-questions") };
  }
  return {
    passage: document.getElementById("passageText"),
    questions: document.getElementById("reading-questions"),
  };
}

/** Paints this part's saved highlights onto what was just rendered. */
export function repaintHighlights() {
  paintMarks(state.marks, currentZones(), currentPart());
}

export function initializeHighlightSystem() {
  initMarks({
    zones: currentZones,
    getPart: currentPart,
    getMarks: () => state.marks,
    setMarks: (list) => { state.marks = list; },
    save: saveState,
    onChange: updateQuestionNav,
  });
}

/** Clears every highlight on the page and in the saved sitting. */
export function clearAllHighlights() {
  state.marks = [];
  document.querySelectorAll("mark.hl").forEach((el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
    parent.normalize();
  });
}
