// Question engine — one system for every IELTS question type, shared by
// the standalone listening test, the standalone reading test and the
// full mock. See normalize.js for the canonical kinds and the legacy
// shapes they absorb; render.js/dnd.js for the renderers; grade.js for
// the unified grading.
export {
  repairListeningIds,
  normalizeListeningItem,
  normalizeListeningSection,
  normalizeReadingQuestions,
  normalizeDragDrop,
  normalizeMapLabelling,
  questionIdsOf,
  optionList,
} from "./normalize.js";
export { splitAnswerVariants, textAnswerCorrect, gradeItem, gradeItems } from "./grade.js";
export { renderItem, gapInlineHTML } from "./render.js";
