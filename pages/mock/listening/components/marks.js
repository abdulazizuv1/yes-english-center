// Highlights and notes for the listening test.
//
// The system itself is shared with the reading test and the full mock and
// lives in pages/mock/engine/marks.js: a highlight is a pair of character
// offsets painted onto whatever the engine has just drawn, so nothing the
// student can answer is ever replaced. This file only wires that system
// to this page's session.
import { listeningState } from "./state.js?v=3.4";
import { saveSession } from "./session.js?v=3.4";
import { paintMarks, initMarks as initSharedMarks } from "../../engine/marks.js?v=3.4";

/** Paints every saved mark for this part onto the page. */
export function paintPart(part, zones) {
  paintMarks(listeningState.session.marks, zones, part);
}

export function initMarks({ zones, getPart, onChange }) {
  return initSharedMarks({
    zones,
    getPart,
    getMarks: () => listeningState.session.marks,
    setMarks: (list) => { listeningState.session.marks = list; },
    save: saveSession,
    onChange,
  });
}
