// Question numbering and the facts derived from it.
//
// Numbering must stay exactly what it has always been: saved answers,
// results and the result page all key off q1..qN. This is the old
// assignQuestionIds, except that it records which numbers belong to which
// part (the bottom bar used to assume 13 / 13 / 14 for every test) and
// starts from nothing each time instead of appending to a global list.
import { normalizeReadingQuestions, gradeItems } from "../../engine/index.js?v=3.2";

export function numberQuestions(passages) {
  let counter = 1;
  const next = () => `q${counter++}`;

  return passages.map((passage, index) => {
    const qIds = [];
    for (const question of passage.questions || []) {
      if (question.type === "question-group" && question.questions) {
        question.questions.forEach((sub) => {
          sub.qId = next();
          sub.parentGroup = question;
          qIds.push(sub.qId);
        });
        question.qIds = question.questions.map((q) => q.qId);
      } else if (question.type === "drag_drop" && question.slots) {
        question.slots.forEach((slot) => {
          slot.qId = next();
          qIds.push(slot.qId);
        });
      } else if (question.type === "map-labelling" && question.questions) {
        question.questions.forEach((row) => {
          row.qId = next();
          qIds.push(row.qId);
        });
      } else if (question.question) {
        question.qId = next();
        qIds.push(question.qId);
      } else if (question.type === "table") {
        const columnKeys = (question.columns || []).slice(1).map((c) => c.toLowerCase());
        question.qIds = [];
        for (const row of question.rows || []) {
          for (const key of columnKeys) {
            if (typeof row[key] === "string" && row[key].includes("___q")) {
              row[key] = row[key].replace(/___q\d+___/g, () => {
                const qId = next();
                question.qIds.push(qId);
                qIds.push(qId);
                return `___${qId}___`;
              });
            }
          }
        }
      }
    }
    const nums = qIds.map((id) => Number(id.slice(1)));
    return {
      index,
      qIds,
      first: nums.length ? Math.min(...nums) : 0,
      last: nums.length ? Math.max(...nums) : 0,
    };
  });
}

/** Engine items for every part, normalized once per load. */
export function buildItems(passages) {
  return passages.map((p) => normalizeReadingQuestions(p.questions || []));
}

/** Which part a question number lives in. */
export function partOfQuestion(parts, qId) {
  const found = parts.find((p) => p.qIds.includes(qId));
  return found ? found.index : 0;
}

/**
 * qId -> true when the student has given an answer. Read through the
 * engine's grading rows so every question kind (multi-select, drag and
 * drop, tables) counts the same way it is marked.
 */
export function answeredMap(itemsByPart, answers) {
  const map = {};
  const graded = gradeItems(itemsByPart.flat(), answers || {});
  graded.rows.forEach((row) => {
    const u = row.user;
    map[row.id] =
      u !== undefined && u !== null &&
      (typeof u === "string" ? u.trim() !== "" : Array.isArray(u) ? u.length > 0 : true);
  });
  return map;
}
