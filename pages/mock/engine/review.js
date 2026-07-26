// ═══════════════════════════════════════════════════════════════════════
// Question engine — REVIEW: the answer breakdown every result page shows.
//
// The three result viewers each had their own idea of "is this answer
// correct", and they disagreed with the marks students were actually
// given: reading compared strings exactly (so "holidays" against the key
// "holiday, holidays" showed red although the point was awarded), while
// the full mock stripped word endings (so "engine" against "engines"
// showed green although no point was awarded). Grading lives in one
// place — grade.js — and the review reads from it.
//
//   reviewRows(items, answers)              test doc available: rich rows
//                                           (question text, option labels)
//   reviewFromStored(answers, correctKeys)  test doc gone: rows rebuilt
//                                           from the saved result alone
//
// Every row: { id, number, correct, status, userDisplay, expectedDisplay }
// status is "correct" | "incorrect" | "unanswered" — what the pages colour.
// ═══════════════════════════════════════════════════════════════════════
import { gradeItem, splitAnswerVariants, textAnswerCorrect } from "./grade.js";

const numberOf = (id) => String(id ?? "").replace(/\D/g, "");

const isBlank = (v) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0) ||
  String(v) === "null" ||
  String(v) === "undefined";

/** "holiday, holidays" → "holiday / holidays" (what the student may write) */
export function formatExpected(expected) {
  const parts = (expected || [])
    .filter((a) => typeof a === "string" || typeof a === "number")
    .flatMap((a) => splitAnswerVariants(a));
  return [...new Set(parts)].join(" / ");
}

/** A letter answer shown with its option text: "B" → "B. free gift" */
export function answerLabel(item, value) {
  if (isBlank(value)) return "";
  const raw = String(value);
  const options = optionsOf(item);
  const hit = options.find((o) => String(o.label).toUpperCase() === raw.toUpperCase());
  return hit && hit.text ? `${hit.label}. ${hit.text}` : raw;
}

function optionsOf(item) {
  if (!item) return [];
  if (Array.isArray(item.options) && item.options.length) return item.options;
  // drag types label their cards instead of options
  if (Array.isArray(item.items) && item.items.length) {
    return item.items.map((i) => ({ label: i.id, text: i.text }));
  }
  return [];
}

/** Question text for a row, when the engine item can supply one. */
function questionTextFor(item, id) {
  switch (item.kind) {
    case "gap":
    case "choice":
    case "match":
      return item.text || "";
    case "gap-group": {
      const gap = item.gaps.find((g) => g.id === id);
      return gap ? gap.text : "";
    }
    case "match-group":
    case "map-labelling": {
      const row = item.rows.find((r) => r.id === id);
      return row ? row.text : item.title || "";
    }
    case "multi-select":
      return item.stem || "";
    case "drag-slots":
    case "drag-inline": {
      const slot = item.slots.find((s) => s.qId === id || `${item.groupId}:${s.slotId}` === id);
      return slot?.label || item.question || item.title || "";
    }
    case "table":
      return item.title || "";
    default:
      return "";
  }
}

function statusOf(user, correct) {
  if (isBlank(user)) return "unanswered";
  return correct ? "correct" : "incorrect";
}

/**
 * Rows for a result whose test document is still available: the engine
 * knows the question kind, so option letters get their text and gaps get
 * their sentence.
 */
export function reviewRows(items, answers) {
  const rows = [];
  for (const item of items) {
    for (const graded of gradeItem(item, answers || {})) {
      rows.push({
        id: graded.id,
        number: numberOf(graded.id),
        kind: item.kind,
        correct: graded.correct,
        status: statusOf(graded.user, graded.correct),
        user: graded.user,
        expected: graded.expected,
        userDisplay: answerLabel(item, graded.user),
        expectedDisplay: expectedDisplayFor(item, graded.expected),
        questionText: questionTextFor(item, graded.id),
      });
    }
  }
  return sortByNumber(rows);
}

function expectedDisplayFor(item, expected) {
  const options = optionsOf(item);
  if (!options.length) return formatExpected(expected);
  // letter keys read better with their option text
  const labelled = (expected || []).map((e) => answerLabel(item, e)).filter(Boolean);
  return labelled.length ? [...new Set(labelled)].join(" / ") : formatExpected(expected);
}

/**
 * Rows rebuilt from the saved result alone — used when the test document
 * has been deleted (results outlive tests) or when a viewer never loads
 * the test. Same comparison, so the two paths can never disagree.
 */
export function reviewFromStored(answers, correctAnswers) {
  const rows = [];
  Object.entries(correctAnswers || {}).forEach(([id, expectedRaw]) => {
    const expected = Array.isArray(expectedRaw) ? expectedRaw : [expectedRaw];
    const user = answers?.[id];
    const correct = textAnswerCorrect(user, expected);
    rows.push({
      id,
      number: numberOf(id),
      kind: null,
      correct,
      status: statusOf(user, correct),
      user: user ?? null,
      expected,
      userDisplay: isBlank(user) ? "" : String(user),
      expectedDisplay: formatExpected(expected),
      questionText: "",
    });
  });
  return sortByNumber(rows);
}

function sortByNumber(rows) {
  return rows.sort((a, b) => {
    const d = (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0);
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Results are marked once, at submission, and that score is what the
 * dashboard and the teacher's analytics show — so the result page leads
 * with it. Grading bugs fixed since then (comma variants, drag slots)
 * mean a handful of older attempts now review differently; say so
 * instead of quietly showing a tick count that contradicts the score.
 */
export function scoreNotice(storedScore, rows) {
  if (typeof storedScore !== "number") return "";
  const recomputed = rows.filter((r) => r.status === "correct").length;
  if (recomputed === storedScore) return "";
  return `This attempt was marked ${storedScore}; rechecking it today gives ${recomputed}. Your recorded score stays ${storedScore}.`;
}

/** Totals the result pages print. */
export function reviewSummary(rows) {
  const correct = rows.filter((r) => r.status === "correct").length;
  const incorrect = rows.filter((r) => r.status === "incorrect").length;
  const unanswered = rows.filter((r) => r.status === "unanswered").length;
  const total = rows.length;
  return {
    correct,
    incorrect,
    unanswered,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
  };
}
