// ═══════════════════════════════════════════════════════════════════════
// Question engine — grade: one grading path for every canonical kind.
// Pure functions, no DOM — runnable in node.
//
// Text answers: case/whitespace-insensitive; an answer key may list
// variants separated by commas ("holiday, holidays") or slashes
// ("US/American"); a comma directly between digits (6,000) is a thousand
// separator, not a variant break.
// ═══════════════════════════════════════════════════════════════════════
import { questionIdsOf } from "./normalize.js";

export function splitAnswerVariants(key) {
  const parts = [];
  for (const seg of String(key).split(",")) {
    const prev = parts[parts.length - 1];
    if (prev !== undefined && /\d$/.test(prev) && /^\d/.test(seg)) {
      parts[parts.length - 1] = `${prev},${seg}`;
    } else {
      parts.push(seg);
    }
  }
  return parts.map((v) => v.trim()).filter(Boolean);
}

const clean = (s) => String(s ?? "").toLowerCase().trim();

// One raw key entry (may itself hold comma/slash variants) vs the answer.
function keyMatches(userClean, rawKey) {
  return splitAnswerVariants(rawKey).some((variant) => {
    const v = clean(variant);
    if (v.includes("/")) {
      return v.split("/").some((alt) => clean(alt.replace(/[()]/g, "")) === clean(userClean.replace(/[()]/g, "")));
    }
    return v === userClean;
  });
}

// answerKey: array of raw key strings. user: whatever the page stored.
export function textAnswerCorrect(user, answerKey) {
  if (!answerKey || answerKey.length === 0) return false;
  let u = user;
  if (Array.isArray(u)) u = u[0] ?? "";
  u = clean(u);
  if (u === "") return false;
  return answerKey.some((k) => keyMatches(u, k));
}

// ── per-kind grading ──
// Returns rows: {id, expected: [raw keys], user, correct}
export function gradeItem(item, answers) {
  const get = (id) => answers?.[id];

  switch (item.kind) {
    case "gap":
      return [row(item.id, item.answerKey, get(item.id))];
    case "gap-group":
      return item.gaps.map((g) => row(g.id, g.answerKey, get(g.id)));
    case "choice":
      return [row(item.id, item.answerKey, get(item.id))];
    case "match":
      return [row(item.id, item.answerKey, get(item.id))];
    case "match-group":
      return item.rows.map((r) => row(r.id, r.answerKey, get(r.id)));
    case "map-labelling":
      return item.rows.map((r) => row(r.id, r.answerKey, get(r.id)));
    case "multi-select":
      // one stored letter per sub-question id (the pages distribute
      // selections across the ids)
      return item.subs.map((s) => row(s.id, s.answerKey, get(s.id)));
    case "table": {
      const ids = questionIdsOf(item);
      return ids.map((id) => {
        const num = String(id).replace(/\D/g, "");
        return row(id, item.answerByNumber[num] || [], get(id));
      });
    }
    case "drag-inline":
      return item.slots.map((s) =>
        row(s.qId, s.correctId ? [s.correctId] : [], get(s.qId))
      );
    case "drag-slots": {
      if (item.storage === "per-slot") {
        return item.slots.map((s) =>
          row(s.qId, s.correctId ? [s.correctId] : [], get(s.qId))
        );
      }
      // grouped: one object {slotId: itemId} stored under the group id
      const stored = get(item.groupId);
      return item.slots.map((s) => {
        const user = stored && typeof stored === "object" ? stored[s.slotId] : undefined;
        return {
          id: `${item.groupId}:${s.slotId}`,
          expected: s.correctId ? [s.correctId] : [],
          user: user ?? null,
          correct: !!s.correctId && clean(user) === clean(s.correctId),
        };
      });
    }
    default:
      return [];
  }
}

function row(id, answerKey, user) {
  return {
    id,
    expected: answerKey || [],
    user: user ?? null,
    correct: textAnswerCorrect(user, answerKey || []),
  };
}

// Grade a whole list of canonical items.
export function gradeItems(items, answers) {
  const rows = [];
  items.forEach((item) => rows.push(...gradeItem(item, answers)));
  const correct = rows.filter((r) => r.correct).length;
  return { rows, correct, total: rows.length };
}
