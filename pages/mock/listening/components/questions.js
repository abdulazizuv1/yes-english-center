// The parts of the test and the facts derived from them.
//
// Question ids stay exactly what they have always been (q1..q40 from the
// test document, repaired by the engine where an old import left gaps):
// saved answers, results and the result page all key off them.
import {
  repairListeningIds,
  normalizeListeningSection,
  gradeItems,
} from "../../engine/index.js?v=3.4";

/** Engine items and the question numbers of every part. */
export function buildParts(sections) {
  repairListeningIds(sections);
  const items = sections.map((s) => normalizeListeningSection(s));
  const parts = items.map((list, index) => {
    const seen = new Set();
    const qIds = gradeItems(list, {}).rows
      .map((r) => r.id)
      .filter((id) => id && !seen.has(id) && seen.add(id));
    const nums = qIds.map((id) => Number(String(id).replace(/\D/g, ""))).filter(Number.isFinite);
    return {
      index,
      qIds,
      first: nums.length ? Math.min(...nums) : 0,
      last: nums.length ? Math.max(...nums) : 0,
    };
  });
  return { items, parts };
}

/**
 * The recording's files in playing order. A test uploaded as one file
 * carries that same file on every part: it is one file, played once.
 */
export function buildTracks(sections) {
  const tracks = [];
  sections.forEach((s, part) => {
    const url = s.audioUrl;
    if (!url) return;
    if (tracks.length && tracks[tracks.length - 1].url === url) return;
    tracks.push({ url, part });
  });
  return tracks;
}

/** Which part a question number lives in. */
export function partOfQuestion(parts, qId) {
  const found = parts.find((p) => p.qIds.includes(qId));
  return found ? found.index : 0;
}

/**
 * qId -> true when the student has given an answer. Read through the
 * engine's grading rows so every question kind (multi-select, matching,
 * tables) counts the same way it is marked.
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
