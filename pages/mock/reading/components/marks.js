// Highlights and notes for the reading test.
//
// The system itself is shared with the full mock and lives in
// pages/mock/engine/marks.js — a highlight is a pair of character
// offsets painted onto whatever the engine has just drawn, so nothing
// the student can answer is ever replaced. This file only wires that
// system to this page's session.
import { readingState } from "./state.js?v=3.2";
import { saveSession } from "./session.js?v=3.2";
import {
  textNodesIn,
  rangeToOffsets,
  paintMark,
  unpaintMark,
  paintMarks,
  initMarks as initSharedMarks,
} from "../../engine/marks.js?v=3.2";

export { textNodesIn, rangeToOffsets, paintMark, unpaintMark };

/** Paints every saved mark for this part onto the page. */
export function paintPart(part, zones) {
  paintMarks(readingState.session.marks, zones, part);
}

export function initMarks({ zones, getPart, onChange }) {
  return initSharedMarks({
    zones,
    getPart,
    getMarks: () => readingState.session.marks,
    setMarks: (list) => { readingState.session.marks = list; },
    save: saveSession,
    onChange,
  });
}
