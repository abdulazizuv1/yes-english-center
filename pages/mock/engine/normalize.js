// ═══════════════════════════════════════════════════════════════════════
// Question engine — normalize: every legacy Firestore shape → canonical
// items. Pure functions, no DOM, no Firebase — runnable in node.
//
// Canonical kinds (one renderer + one grader per kind, shared by the
// standalone listening test, the standalone reading test and the full
// mock):
//
//   content        title / subheading / plain text (not gradeable)
//   gap            one typed blank inline in a sentence
//   gap-group      reading-style completion block: header + list of gaps
//   choice         single-answer radio (MC, TFNG, YNNG via `style`)
//   multi-select   "choose TWO/THREE" checkbox bank spanning N numbers
//   match          one dropdown against a shared option list
//   match-group    options box + rows of dropdowns (listening matching)
//   table          completion table with ___qN___ gaps in cells
//   drag-slots     drag cards from a bank onto labelled slots
//   drag-inline    drag words from a bank into {0} gaps inside a text
//   map-labelling  image + numbered label rows answered with letters
//
// IELTS mapping (per ielts.org): both sections share multiple choice,
// matching, the completion family (note/table/flow-chart/summary/
// sentence) and short answers; listening adds form completion and
// plan/map/diagram labelling; reading adds TFNG / YNNG, matching
// headings / information / sentence endings and word-bank summaries.
// Matching headings & sentence endings are authored as drag-slots,
// word-bank summaries as drag-inline, plan/map labelling as
// map-labelling.
// ═══════════════════════════════════════════════════════════════════════

// Options arrive either as {A: "text"} objects or [{label, text}] arrays.
export function optionList(options) {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options
      .filter((o) => o && (o.label || o.text))
      .map((o) => ({ label: String(o.label ?? "").trim(), text: String(o.text ?? "") }));
  }
  return Object.keys(options)
    .sort()
    .map((label) => ({ label, text: String(options[label] ?? "") }));
}

const numberOf = (id) => String(id ?? "").replace(/\D/g, "");

function answerKey(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim() !== "");
  return String(value).trim() === "" ? [] : [String(value)];
}

/* ─────────────────────────── LISTENING ─────────────────────────── */

// Ensures every gradeable listening item has a questionId, and repairs
// multi-select groups saved with only `correctAnswers` (no questions[]),
// which older add-tool exports produced (e.g. full mock test 15). A single
// running counter walks all sections so synthesized IDs slot into the real
// 1–40 sequence. Call once before normalizing/rendering.
export function repairListeningIds(sections) {
  if (!Array.isArray(sections)) return;
  let n = 1;
  const sync = (id) => {
    const num = parseInt(String(id).replace(/\D/g, ""), 10);
    if (Number.isFinite(num)) n = num + 1;
  };
  for (const section of sections) {
    for (const item of section.content || []) {
      if (item.type === "question") {
        if (!item.questionId) item.questionId = `q${n}`;
        sync(item.questionId);
      } else if (item.type === "question-group" || item.type === "matching") {
        if (Array.isArray(item.questions) && item.questions.length) {
          item.questions.forEach((q) => {
            if (!q.questionId) q.questionId = q.qId || `q${n}`;
            sync(q.questionId);
          });
        } else if (Array.isArray(item.correctAnswers) && item.correctAnswers.length) {
          const start = n;
          item.questions = item.correctAnswers.map((ans, i) => ({
            questionId: `q${start + i}`,
            correctAnswer: ans,
          }));
          n = start + item.correctAnswers.length;
        }
        const ids = (item.questions || []).map((q) => q.questionId);
        if (ids.length && !item.questionId) {
          const first = parseInt(String(ids[0]).replace(/\D/g, ""), 10);
          const last = parseInt(String(ids[ids.length - 1]).replace(/\D/g, ""), 10);
          item.questionId = last > first ? `q${first}_${last}` : `q${first}`;
        }
      } else if (item.type === "table") {
        // Advance the counter past any ___qN___ placeholders in the cells
        const nums = (JSON.stringify(item).match(/q(\d+)/g) || [])
          .map((s) => parseInt(s.slice(1), 10))
          .filter(Number.isFinite);
        if (nums.length) n = Math.max(n, Math.max(...nums) + 1);
      } else if (item.type === "drag_drop" || item.type === "map-labelling") {
        const subs = item.slots || item.questions || [];
        subs.forEach((s) => {
          const id = s.qId || s.questionId;
          if (id) sync(id);
        });
      }
    }
  }
}

// One listening content[] item → canonical item (or null to skip).
export function normalizeListeningItem(item) {
  if (!item || typeof item !== "object") return null;
  const instruction = item.groupInstruction || null;

  switch (item.type) {
    case "title":
      return { kind: "content", variant: "title", text: item.value || item.text || "", instruction, raw: item };
    case "subheading":
      return { kind: "content", variant: "subheading", text: item.value || item.text || "", instruction, raw: item };
    case "text":
      return { kind: "content", variant: "text", text: item.value || item.text || item.title || "", instruction, raw: item };

    case "question": {
      const id = item.questionId;
      if (item.format === "gap-fill") {
        return {
          kind: "gap", id, number: numberOf(id),
          text: item.text || "", postfix: item.postfix || "",
          wordLimit: item.wordLimit || null,
          answerKey: answerKey(item.correctAnswer),
          instruction, raw: item,
        };
      }
      if (item.format === "true-false-notgiven") {
        return {
          kind: "choice", style: "tfng", id, number: numberOf(id),
          text: item.text || "",
          options: ["TRUE", "FALSE", "NOT GIVEN"].map((l) => ({ label: l, text: "" })),
          answerKey: answerKey(item.correctAnswer),
          instruction, raw: item,
        };
      }
      // multiple-choice and anything option-shaped
      return {
        kind: "choice", style: "mc", id, number: numberOf(id),
        text: item.text || "",
        options: optionList(item.options),
        answerKey: answerKey(item.correctAnswer),
        instruction, raw: item,
      };
    }

    case "question-group": {
      if (item.groupType === "matching") {
        return {
          kind: "match-group",
          groupId: item.questionId || null,
          stem: item.text || "",
          heading: item.instructions || "",
          options: optionList(item.options),
          rows: (item.questions || []).map((q) => ({
            id: q.questionId, number: numberOf(q.questionId),
            text: q.text || "", answerKey: answerKey(q.correctAnswer),
          })),
          instruction, raw: item,
        };
      }
      // multi-select ("choose TWO")
      let subs = [];
      if (Array.isArray(item.questions) && item.questions.length) {
        subs = item.questions.map((q) => ({ id: q.questionId, answerKey: answerKey(q.correctAnswer) }));
      } else if (Array.isArray(item.correctAnswers)) {
        // legacy exports without questions[] — ids synthesized by the page
        subs = item.correctAnswers.map((ans, i) => ({ id: item.__synthIds?.[i] ?? null, answerKey: answerKey(ans) }));
      }
      return {
        kind: "multi-select",
        groupId: item.questionId || null,
        stem: item.text || "",
        heading: item.instructions || "",
        options: optionList(item.options),
        subs, max: subs.length || null,
        instruction, raw: item,
      };
    }

    // flat legacy matching (old imports: type "matching" directly)
    case "matching":
      return {
        kind: "match-group",
        groupId: item.questionId || null,
        stem: item.text || "", heading: item.title || "",
        options: optionList(item.options),
        rows: (item.questions || []).map((q) => ({
          id: q.questionId || q.qId, number: numberOf(q.questionId || q.qId),
          text: q.text || "", answerKey: answerKey(q.correctAnswer ?? q.correct),
        })),
        instruction, raw: item,
      };

    case "table":
      return normalizeTable(item, /___q(\d+)___/g, "listening", instruction);

    case "drag_drop":
      return normalizeDragDrop(item, instruction);
    case "map-labelling":
      return normalizeMapLabelling(item, instruction);

    default:
      return null;
  }
}

export function normalizeListeningSection(section) {
  const items = (section?.content || [])
    .map(normalizeListeningItem)
    .filter(Boolean);

  // very old flat sections: multiSelect / matching keys beside content
  ["multiSelect", "multiSelect1", "multiSelect2", "matching"].forEach((key) => {
    const g = section?.[key];
    if (g && g.matchingQuestions) {
      items.push({
        kind: "match-group",
        groupId: null,
        stem: g.question || "", heading: g.heading || "",
        options: optionList(g.options),
        rows: g.matchingQuestions.map((q) => ({
          id: q.qId, number: numberOf(q.qId),
          text: q.text || "", answerKey: answerKey(q.correctAnswer),
        })),
        instruction: null, raw: g,
      });
    }
  });

  return items;
}

/* ─────────────────────────── READING ─────────────────────────── */

// The reading pages number questions by ORDER before rendering, so every
// gradeable q already carries qId ("q7" standalone / "reading_q7" full
// mock). Consecutive gap-fills collapse into gap-group blocks exactly the
// way the legacy renderers batched them.
export function normalizeReadingQuestions(questions) {
  const out = [];
  let group = null; // {kind:"gap-group", header:{...}, gaps:[]}

  const flush = () => {
    if (group && group.gaps.length) out.push(group);
    group = null;
  };

  (questions || []).forEach((q) => {
    const instruction = q.groupInstruction || null;

    if (q.type === "gap-fill") {
      if (!q.question && (q.title || q.subheading || q.text)) {
        // header row starts a fresh block
        flush();
        group = {
          kind: "gap-group",
          header: { title: q.title || "", subtitle: q.subheading || "", info: q.text || "" },
          gaps: [], instruction, raw: q,
        };
      } else if (q.question && q.qId) {
        if (!group) group = { kind: "gap-group", header: null, gaps: [], instruction, raw: q };
        if (instruction && !group.instruction) group.instruction = instruction;
        group.gaps.push({
          kind: "gap", id: q.qId, number: numberOf(q.qId),
          text: q.question, postfix: q.postfix || "",
          wordLimit: q.wordLimit || null,
          answerKey: answerKey(q.answer),
          instruction, raw: q,
        });
      }
      return;
    }

    flush();

    switch (q.type) {
      case "text-question":
        out.push({
          kind: "content", variant: "text-question",
          title: q.title || "", subtitle: q.subheading || "", text: q.text || "",
          instruction, raw: q,
        });
        return;
      case "true-false-notgiven":
      case "yes-no-notgiven": {
        const tf = q.type === "true-false-notgiven";
        out.push({
          kind: "choice", style: tf ? "tfng" : "ynng",
          id: q.qId, number: numberOf(q.qId),
          text: q.question || "",
          options: (tf ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"]).map((l) => ({ label: l, text: "" })),
          answerKey: answerKey(q.answer),
          instruction, raw: q,
        });
        return;
      }
      case "multiple-choice":
        out.push({
          kind: "choice", style: "mc",
          id: q.qId, number: numberOf(q.qId),
          text: q.question || "",
          options: optionList(q.options),
          answerKey: answerKey(q.answer),
          instruction, raw: q,
        });
        return;
      case "paragraph-matching":
      case "match-person":
      case "match-purpose":
        out.push({
          kind: "match",
          matchStyle: q.type,
          id: q.qId, number: numberOf(q.qId),
          text: q.question || "",
          options: optionList(q.options),
          answerKey: answerKey(q.answer),
          instruction, raw: q,
        });
        return;
      case "table": {
        out.push(normalizeTable(q, /___((?:reading_)?q\d+)___/g, "reading", instruction));
        return;
      }
      case "question-group": {
        const subs = (q.questions || []).map((s) => ({ id: s.qId, answerKey: answerKey(s.correctAnswer ?? s.answer) }));
        out.push({
          kind: "multi-select",
          groupId: q.questionId || null,
          stem: q.text || "", heading: q.instructions || "",
          options: optionList(q.options),
          subs, max: subs.length || null,
          instruction, raw: q,
        });
        return;
      }
      case "drag_drop":
        out.push(normalizeDragDrop(q, instruction));
        return;
      case "map-labelling":
        out.push(normalizeMapLabelling(q, instruction));
        return;
      default:
        return;
    }
  });

  flush();
  return out;
}

/* ─────────────────────────── SHARED ─────────────────────────── */

function normalizeTable(item, markerRe, tableStyle, instruction) {
  // answer keys: {q37: "..."} / {37: "..."} / {qq37: "..."} tolerated
  const key = {};
  Object.entries(item.answer || {}).forEach(([k, v]) => {
    const num = String(k).replace(/\D/g, "");
    if (num) key[num] = answerKey(v);
  });
  return {
    kind: "table",
    // listening tables map every column to row[collapsed key]; reading
    // tables show row.column first, then row[lowercased key]
    tableStyle,
    title: item.title || "",
    columns: item.columns || [],
    rows: item.rows || [],
    markerRe: markerRe.source,
    answerByNumber: key,
    instruction, raw: item,
  };
}

// Two saved shapes: cards (items+slots, answers stored as an object under
// the group qId) and inline text with {0} gaps (answers stored per slot
// qId). New tests may also use per-slot ids with cards.
export function normalizeDragDrop(q, instruction = q.groupInstruction || null) {
  const items = (q.items || []).map((i) => ({ id: String(i.id), text: String(i.text ?? "") }));
  const slots = (q.slots || []).map((s) => ({
    slotId: s.slotId || s.qId || null,
    qId: s.qId || null,
    label: s.label || "",
    correctId: s.correctId != null ? String(s.correctId) : null,
  }));
  const perSlot = slots.every((s) => s.qId);
  return {
    kind: q.inlineText ? "drag-inline" : "drag-slots",
    groupId: q.qId || q.questionId || null,
    question: q.question || "", title: q.title || "",
    inlineText: q.inlineText || "",
    items, slots,
    storage: perSlot ? "per-slot" : "grouped",
    instruction, raw: q,
  };
}

// New type: plan/map/diagram labelling — an image plus numbered label
// rows answered with option letters (dropdowns, CDT style).
export function normalizeMapLabelling(q, instruction = q.groupInstruction || null) {
  return {
    kind: "map-labelling",
    groupId: q.questionId || q.qId || null,
    title: q.title || "",
    imageUrl: q.imageUrl || "",
    options: optionList(q.options),
    rows: (q.questions || []).map((r) => ({
      id: r.questionId || r.qId,
      number: numberOf(r.questionId || r.qId),
      text: r.text || r.label || "",
      answerKey: answerKey(r.correctAnswer ?? r.answer),
    })),
    instruction, raw: q,
  };
}

// Every gradeable question id inside a canonical item, in display order.
export function questionIdsOf(item) {
  switch (item.kind) {
    case "gap": return [item.id];
    case "gap-group": return item.gaps.map((g) => g.id);
    case "choice": return [item.id];
    case "match": return [item.id];
    case "match-group": return item.rows.map((r) => r.id);
    case "multi-select": return item.subs.map((s) => s.id);
    case "map-labelling": return item.rows.map((r) => r.id);
    case "table": {
      const re = new RegExp(item.markerRe, "g");
      const ids = [];
      item.rows.forEach((row) => {
        Object.values(row).forEach((cell) => {
          if (typeof cell !== "string") return;
          for (const m of cell.matchAll(re)) ids.push(m[1].startsWith("q") || m[1].startsWith("reading_") ? m[1] : `q${m[1]}`);
        });
      });
      return ids;
    }
    case "drag-slots":
      return item.storage === "per-slot" ? item.slots.map((s) => s.qId) : [item.groupId];
    case "drag-inline":
      return item.slots.map((s) => s.qId);
    default: return [];
  }
}
