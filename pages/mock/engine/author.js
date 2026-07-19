// ═══════════════════════════════════════════════════════════════════════
// Question engine — AUTHOR side: one set of editor forms + collectors for
// every question kind, shared by the add AND edit tools of the listening
// test, the reading test and the full mock.
//
//   editorHTML(target, kind, uid, prefill)  form markup; prefill = legacy
//                                           item → the same forms serve
//                                           the edit tools
//   collectEditor(rootEl, target)           form → legacy-compatible JSON
//                                           (throws readable validation
//                                           errors; no numbering — the
//                                           tools assign qN on save)
//   detectKind(item, target)                legacy item → editor kind
//   authorKinds(target)                     menu list incl. NEW types:
//                                           drag-slots, drag-inline,
//                                           map-labelling
//
// Saved shapes stay 100% legacy-compatible: the test engine's
// normalize.js already reads everything emitted here.
// ═══════════════════════════════════════════════════════════════════════

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* ─────────────────────────── kind registry ─────────────────────────── */

const KINDS = {
  // content blocks (listening flow)
  "text":               { label: "Text line",            targets: ["listening"] },
  "subheading":         { label: "Subheading",           targets: ["listening"] },
  "text-question":      { label: "Text block",           targets: ["reading"] },
  // gradeable
  "gap-fill":           { label: "Gap fill",             targets: ["listening", "reading"] },
  "multiple-choice":    { label: "Multiple choice",      targets: ["listening", "reading"] },
  "true-false-notgiven":{ label: "True / False / NG",    targets: ["listening", "reading"] },
  "yes-no-notgiven":    { label: "Yes / No / NG",        targets: ["reading"] },
  "paragraph-matching": { label: "Paragraph matching",   targets: ["reading"] },
  "match-person":       { label: "Match person",         targets: ["reading"] },
  "match-purpose":      { label: "Match purpose",        targets: ["reading"] },
  "question-group":     { label: "Group (multi-select / matching)", targets: ["listening", "reading"] },
  "table":              { label: "Table completion",     targets: ["listening", "reading"] },
  // NEW types
  "drag-slots":         { label: "Drag & drop: match (headings / features / endings)", targets: ["listening", "reading"], isNew: true },
  "drag-inline":        { label: "Drag & drop: word bank in text (summary)",           targets: ["listening", "reading"], isNew: true },
  "map-labelling":      { label: "Map / plan labelling",                               targets: ["listening", "reading"], isNew: true },
};

export function authorKinds(target) {
  return Object.entries(KINDS)
    .filter(([, def]) => def.targets.includes(target))
    .map(([kind, def]) => ({ kind, label: def.label, isNew: !!def.isNew }));
}

// legacy item (as stored in Firestore) → editor kind
export function detectKind(item, target) {
  if (!item || typeof item !== "object") return null;
  if (target === "listening") {
    if (item.type === "text" || item.type === "title") return "text";
    if (item.type === "subheading") return "subheading";
    if (item.type === "question") {
      if (item.format === "multiple-choice") return "multiple-choice";
      if (item.format === "true-false-notgiven") return "true-false-notgiven";
      return "gap-fill";
    }
    if (item.type === "question-group" || item.type === "matching") return "question-group";
    if (item.type === "table") return "table";
  } else {
    if (item.type === "text-question") return "text-question";
    if (item.type === "gap-fill") return "gap-fill";
    if (item.type === "question-group" || item.type === "multi-select") return "question-group";
    if (KINDS[item.type]) return item.type;
  }
  if (item.type === "drag_drop") return item.inlineText ? "drag-inline" : "drag-slots";
  if (item.type === "map-labelling") return "map-labelling";
  return null;
}

/* ─────────────────────────── form helpers ─────────────────────────── */

const giField = (value) =>
  `<textarea placeholder="Group instruction (optional — instruction band shown above)" class="au-gi form-input" rows="2">${esc(value || "")}</textarea>`;

function optionRows(list, { labelPh = "A", textPh = "Option text" } = {}) {
  const rows = list.length ? list : [{ label: "A", text: "" }, { label: "B", text: "" }];
  return rows
    .map(
      (o) => `<div class="au-opt-row">
        <input type="text" class="au-opt-label form-input" value="${esc(o.label)}" placeholder="${labelPh}">
        <input type="text" class="au-opt-text form-input" value="${esc(o.text)}" placeholder="${textPh}">
        <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
      </div>`
    )
    .join("");
}

// options prefill: object {A: "..."} or array [{label,text}]
function optsList(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options.map((o) => ({ label: o.label ?? "", text: o.text ?? "" }));
  return Object.keys(options).sort().map((label) => ({ label, text: options[label] }));
}

const addRowBtn = (cls, label) =>
  `<button type="button" class="au-add-row nav-btn secondary" data-add="${cls}">+ ${label}</button>`;

function header(kind, badge) {
  return `<div class="au-head"><span class="au-badge">${badge || KINDS[kind].label}</span><button type="button" class="au-remove au-remove-item" onclick="this.closest('.au-item').remove()">Remove</button></div>`;
}

const wrap = (kind, uid, inner) =>
  `<div class="au-item question-item" data-au-kind="${kind}" data-au-uid="${uid}">${inner}</div>`;

/* ─────────────────────────── editor forms ─────────────────────────── */

export function editorHTML(target, kind, uid, prefill = null) {
  const p = prefill || {};
  const gi = p.groupInstruction || "";

  switch (kind) {
    case "text":
    case "subheading":
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-value form-input" placeholder="${kind === "text" ? "Text line" : "Subheading text"}" value="${esc(p.value ?? p.text ?? p.title ?? "")}">`);

    case "text-question":
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-title form-input" placeholder="Title (optional)" value="${esc(p.title || "")}">
        <input type="text" class="au-subheading form-input" placeholder="Subheading (optional)" value="${esc(p.subheading || "")}">
        <input type="text" class="au-text form-input" placeholder="Plain text (optional)" value="${esc(p.text || "")}">`);

    case "gap-fill": {
      const answer = target === "listening" ? p.correctAnswer : Array.isArray(p.answer) ? p.answer.join(", ") : p.answer;
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-text form-input" placeholder="Question text (use _____ for the gap)" value="${esc(p.text ?? p.question ?? "")}">
        <input type="text" class="au-postfix form-input" placeholder="Postfix (optional)" value="${esc(p.postfix || "")}">
        <input type="text" class="au-answer form-input" placeholder="Correct answer — several variants via comma: holiday, holidays" value="${esc(answer || "")}">
        <input type="number" class="au-word-limit form-input" placeholder="Word limit (optional)" min="1" max="10" value="${esc(p.wordLimit || "")}">`);
    }

    case "multiple-choice": {
      const opts = optsList(p.options);
      const answer = (p.correctAnswer ?? p.answer ?? "").toString();
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-text form-input" placeholder="Question text" value="${esc(p.text ?? p.question ?? "")}">
        <div class="au-options">${optionRows(opts)}</div>
        ${addRowBtn("option", "Add option")}
        <input type="text" class="au-answer form-input" placeholder="Correct letter (A, B, C...)" value="${esc(answer)}">`);
    }

    case "true-false-notgiven":
    case "yes-no-notgiven": {
      const values = kind === "true-false-notgiven" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"];
      const answer = (p.correctAnswer ?? p.answer ?? "").toString().toUpperCase();
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-text form-input" placeholder="Statement" value="${esc(p.text ?? p.question ?? "")}">
        <select class="au-answer settings-select form-input"><option value="">Select answer</option>${values
          .map((v) => `<option value="${v}" ${answer === v ? "selected" : ""}>${v}</option>`)
          .join("")}</select>`);
    }

    case "paragraph-matching":
    case "match-person":
    case "match-purpose": {
      const opts = optsList(p.options);
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-text form-input" placeholder="Question text" value="${esc(p.question ?? p.text ?? "")}">
        <div class="au-options">${optionRows(opts, { textPh: "Option text (paragraph / person / purpose)" })}</div>
        ${addRowBtn("option", "Add option")}
        <input type="text" class="au-answer form-input" placeholder="Correct letter" value="${esc(p.answer ?? p.correctAnswer ?? "")}">`);
    }

    case "question-group": {
      const isMatching = p.groupType === "matching" || p.type === "matching";
      const opts = optsList(p.options);
      const subs = (p.questions || []).map((q) => ({
        text: q.text || "",
        answer: q.correctAnswer ?? q.correct ?? "",
      }));
      const letters = (p.questions || [])
        .map((q) => q.correctAnswer)
        .filter(Boolean)
        .join(",") || (Array.isArray(p.correctAnswers) ? p.correctAnswers.join(",") : "");
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <select class="au-group-type settings-select form-input" onchange="this.closest('.au-item').dataset.groupType=this.value; this.closest('.au-item').querySelector('.au-ms-only').style.display=this.value==='multi-select'?'':'none'; this.closest('.au-item').querySelector('.au-match-only').style.display=this.value==='matching'?'':'none';">
          <option value="multi-select" ${!isMatching ? "selected" : ""}>Multi select (choose TWO/THREE)</option>
          <option value="matching" ${isMatching ? "selected" : ""}>Matching</option>
        </select>
        <input type="text" class="au-stem form-input" placeholder="Group question / stem" value="${esc(p.text || "")}">
        <div class="au-options">${optionRows(opts)}</div>
        ${addRowBtn("option", "Add option")}
        <div class="au-ms-only" style="${isMatching ? "display:none" : ""}">
          <input type="text" class="au-ms-answers form-input" placeholder="Correct letters, comma-separated (e.g. A,C)" value="${esc(isMatching ? "" : letters)}">
        </div>
        <div class="au-match-only" style="${isMatching ? "" : "display:none"}">
          <div class="au-subs">${(subs.length ? subs : [{ text: "", answer: "" }])
            .map(
              (s) => `<div class="au-sub-row">
                <input type="text" class="au-sub-text form-input" placeholder="Question / statement" value="${esc(s.text)}">
                <input type="text" class="au-sub-answer form-input" placeholder="Answer (A, B...)" value="${esc(s.answer)}">
                <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
              </div>`
            )
            .join("")}</div>
          ${addRowBtn("sub", "Add question")}
        </div>`);
    }

    case "table": {
      const columns = p.columns && p.columns.length ? p.columns : ["Field", "Information"];
      const rows = p.rows && p.rows.length ? p.rows : [{}];
      const colKey = (c) => c.toLowerCase().replace(/\s+/g, "");
      const answers = Object.entries(p.answer || {})
        .map(([k, v]) => `q${String(k).replace(/\D/g, "")}=${v}`)
        .join(", ");
      const bodyRows = rows
        .map((row) => {
          const cells = columns
            .map((c) => {
              // reading tables put the first column in row.column
              const raw =
                row[colKey(c)] ?? (c === columns[0] ? row.column : row[c.toLowerCase()]) ?? "";
              return `<td><textarea class="au-cell form-input" rows="2" placeholder="Cell text (use ___q1___ or 1____ for a gap)">${esc(String(raw).replace(/<br\s*\/?>/g, "\n"))}</textarea></td>`;
            })
            .join("");
          return `<tr class="au-table-row">${cells}<td><button type="button" class="au-remove" onclick="this.closest('tr').remove()">×</button></td></tr>`;
        })
        .join("");
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-title form-input" placeholder="Table title (optional)" value="${esc(p.title || "")}">
        <div class="au-table-wrap"><table class="au-table">
          <thead><tr class="au-table-head">${columns
            .map((c) => `<th><input type="text" class="au-col form-input" value="${esc(c)}" placeholder="Column"></th>`)
            .join("")}<th></th></tr></thead>
          <tbody class="au-table-body">${bodyRows}</tbody>
        </table></div>
        <div class="au-btn-row">${addRowBtn("table-col", "Add column")}${addRowBtn("table-row", "Add row")}</div>
        <label class="au-label">Answers (q1=answer1, q2=answer2; variants via comma: q3=holiday, holidays)</label>
        <textarea class="au-table-answers form-input" rows="3" placeholder="q1=theatre, q2=4.30...">${esc(answers)}</textarea>`);
    }

    case "drag-slots": {
      const items = (p.items || []).map((i) => ({ id: i.id, text: i.text }));
      const slots = (p.slots || []).map((s) => ({ label: s.label || "", correctId: s.correctId || "" }));
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-title form-input" placeholder="Title (optional)" value="${esc(p.title || "")}">
        <input type="text" class="au-text form-input" placeholder="Task text (e.g. Match each heading to a paragraph)" value="${esc(p.question || "")}">
        <label class="au-label">Draggable cards (the bank)</label>
        <div class="au-dd-items">${(items.length ? items : [{ id: "A", text: "" }, { id: "B", text: "" }])
          .map(
            (i) => `<div class="au-opt-row">
              <input type="text" class="au-dd-id form-input" value="${esc(i.id)}" placeholder="A">
              <input type="text" class="au-dd-text form-input" value="${esc(i.text)}" placeholder="Card text (heading / feature / ending)">
              <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
            </div>`
          )
          .join("")}</div>
        ${addRowBtn("dd-item", "Add card")}
        <label class="au-label">Slots (each slot = one question number)</label>
        <div class="au-dd-slots">${(slots.length ? slots : [{ label: "", correctId: "" }])
          .map(
            (s) => `<div class="au-sub-row">
              <input type="text" class="au-slot-label form-input" value="${esc(s.label)}" placeholder="Slot label (question / paragraph / sentence start)">
              <input type="text" class="au-slot-correct form-input" value="${esc(s.correctId)}" placeholder="Correct card (A, B...)">
              <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
            </div>`
          )
          .join("")}</div>
        ${addRowBtn("dd-slot", "Add slot")}`);
    }

    case "drag-inline": {
      const items = (p.items || []).map((i) => ({ id: i.id, text: i.text }));
      const correct = (p.slots || []).map((s) => s.correctId).join(",");
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-title form-input" placeholder="Title (optional)" value="${esc(p.title || "")}">
        <label class="au-label">Text with numbered gaps {0}, {1}, {2}...</label>
        <textarea class="au-inline-text form-input" rows="5" placeholder="MLB still wanted umpires to shout decisions as in their {0}. The job required a {1}...">${esc(p.inlineText || "")}</textarea>
        <label class="au-label">Word bank (extra distractor cards are fine)</label>
        <div class="au-dd-items">${(items.length ? items : [{ id: "A", text: "" }, { id: "B", text: "" }])
          .map(
            (i) => `<div class="au-opt-row">
              <input type="text" class="au-dd-id form-input" value="${esc(i.id)}" placeholder="A">
              <input type="text" class="au-dd-text form-input" value="${esc(i.text)}" placeholder="Word / phrase">
              <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
            </div>`
          )
          .join("")}</div>
        ${addRowBtn("dd-item", "Add card")}
        <input type="text" class="au-inline-correct form-input" placeholder="Correct card for each gap in order, comma-separated (e.g. C,A,D)" value="${esc(correct)}">`);
    }

    case "map-labelling": {
      const opts = optsList(p.options);
      const rows = (p.questions || []).map((r) => ({ text: r.text || r.label || "", answer: r.correctAnswer ?? r.answer ?? "" }));
      return wrap(kind, uid, `${header(kind)}${giField(gi)}
        <input type="text" class="au-title form-input" placeholder="Title (e.g. Plan of the sports centre)" value="${esc(p.title || "")}">
        <input type="text" class="au-image-url form-input" placeholder="Image URL (upload the plan to Storage and paste the link)" value="${esc(p.imageUrl || "")}">
        <label class="au-label">Locations on the map (letters)</label>
        <div class="au-options">${optionRows(opts, { textPh: "Location name (optional)" })}</div>
        ${addRowBtn("option", "Add letter")}
        <label class="au-label">Labels to identify (each = one question number)</label>
        <div class="au-subs">${(rows.length ? rows : [{ text: "", answer: "" }])
          .map(
            (r) => `<div class="au-sub-row">
              <input type="text" class="au-sub-text form-input" placeholder="Label (e.g. Main entrance)" value="${esc(r.text)}">
              <input type="text" class="au-sub-answer form-input" placeholder="Letter" value="${esc(r.answer)}">
              <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
            </div>`
          )
          .join("")}</div>
        ${addRowBtn("sub", "Add label")}`);
    }

    default:
      return "";
  }
}

/* ─────────────────────────── collectors ─────────────────────────── */

const val = (el, sel) => el.querySelector(sel)?.value?.trim() ?? "";

function collectOptionRows(el, asObject) {
  const list = [];
  el.querySelectorAll(".au-options .au-opt-row").forEach((row) => {
    const label = row.querySelector(".au-opt-label")?.value?.trim();
    const text = row.querySelector(".au-opt-text")?.value?.trim() ?? "";
    if (label) list.push({ label, text });
  });
  if (!asObject) return list;
  const obj = {};
  list.forEach((o) => (obj[o.label] = o.text));
  return obj;
}

// element (rendered by editorHTML) → legacy-compatible JSON item.
// `fail` prefixes errors with the tool's own position label.
export function collectEditor(el, target, positionLabel = "") {
  const kind = el.dataset.auKind;
  const fail = (msg) => {
    throw new Error(`${positionLabel ? positionLabel + ": " : ""}${KINDS[kind]?.label || kind}: ${msg}`);
  };
  const gi = val(el, ".au-gi") || null;
  const need = (v, what) => {
    if (!v) fail(`${what} is required.`);
    return v;
  };

  switch (kind) {
    case "text":
    case "subheading":
      return { type: kind, groupInstruction: gi, value: need(val(el, ".au-value"), "text") };

    case "text-question": {
      const item = {
        type: "text-question", groupInstruction: gi,
        title: val(el, ".au-title"), subheading: val(el, ".au-subheading"), text: val(el, ".au-text"),
      };
      if (!item.title && !item.subheading && !item.text) fail("at least one field is required.");
      return item;
    }

    case "gap-fill": {
      const text = need(val(el, ".au-text"), "question text");
      const answer = need(val(el, ".au-answer"), "answer");
      const wordLimit = parseInt(val(el, ".au-word-limit"), 10) || null;
      if (target === "listening") {
        return {
          type: "question", format: "gap-fill", groupInstruction: gi,
          text, postfix: val(el, ".au-postfix"), correctAnswer: answer, wordLimit,
        };
      }
      return { type: "gap-fill", groupInstruction: gi, question: text, postfix: val(el, ".au-postfix"), answer: [answer], wordLimit };
    }

    case "multiple-choice": {
      const text = need(val(el, ".au-text"), "question text");
      const answer = need(val(el, ".au-answer"), "correct letter").toUpperCase();
      if (target === "listening") {
        const options = collectOptionRows(el, true);
        if (!Object.keys(options).length) fail("options are required.");
        if (!options[answer]) fail(`correct letter "${answer}" is not among the options.`);
        return { type: "question", format: "multiple-choice", groupInstruction: gi, text, options, correctAnswer: answer };
      }
      const options = collectOptionRows(el, false);
      if (!options.length) fail("options are required.");
      if (!options.some((o) => o.label === answer)) fail(`correct letter "${answer}" is not among the options.`);
      return { type: "multiple-choice", groupInstruction: gi, question: text, options, answer };
    }

    case "true-false-notgiven":
    case "yes-no-notgiven": {
      const text = need(val(el, ".au-text"), "statement");
      const answer = need(val(el, ".au-answer"), "answer");
      if (target === "listening") {
        return { type: "question", format: "true-false-notgiven", groupInstruction: gi, text, correctAnswer: answer };
      }
      return { type: kind, groupInstruction: gi, question: text, answer };
    }

    case "paragraph-matching":
    case "match-person":
    case "match-purpose": {
      const options = collectOptionRows(el, false);
      if (!options.length) fail("options are required.");
      const answer = need(val(el, ".au-answer"), "correct letter").toUpperCase();
      if (!options.some((o) => o.label.toUpperCase() === answer)) fail(`correct letter "${answer}" is not among the options.`);
      return { type: kind, groupInstruction: gi, question: need(val(el, ".au-text"), "question text"), options, answer };
    }

    case "question-group": {
      const groupType = el.querySelector(".au-group-type")?.value || "multi-select";
      const options = collectOptionRows(el, true);
      if (!Object.keys(options).length) fail("options are required.");
      const stem = val(el, ".au-stem");
      if (groupType === "matching") {
        const questions = [];
        el.querySelectorAll(".au-subs .au-sub-row").forEach((row) => {
          const text = row.querySelector(".au-sub-text")?.value?.trim();
          const answer = row.querySelector(".au-sub-answer")?.value?.trim()?.toUpperCase();
          if (!text && !answer) return;
          if (!text || !answer) fail("every matching row needs both a question and an answer.");
          if (!options[answer]) fail(`matching answer "${answer}" is not among the option letters.`);
          questions.push({ text, correctAnswer: answer });
        });
        if (!questions.length) fail("at least one matching question is required.");
        return { type: "question-group", groupType: "matching", groupInstruction: gi, text: stem, options, questions };
      }
      const letters = need(val(el, ".au-ms-answers"), "correct letters")
        .split(",").map((a) => a.trim().toUpperCase()).filter(Boolean);
      if (!letters.length) fail("at least one correct letter is required.");
      letters.forEach((a) => {
        if (!options[a]) fail(`correct letter "${a}" is not among the options.`);
      });
      return {
        type: "question-group", groupType: "multi-select", groupInstruction: gi,
        text: need(stem, "group question"), options,
        questions: letters.map((ans) => ({ correctAnswer: ans })),
      };
    }

    case "table": {
      const columns = [...el.querySelectorAll(".au-table-head .au-col")]
        .map((c) => c.value.trim()).filter(Boolean);
      if (columns.length < 2) fail("at least two columns are required.");
      const colKey = (c) => c.toLowerCase().replace(/\s+/g, "");
      const rows = [];
      let gapCount = 0;
      el.querySelectorAll(".au-table-body .au-table-row").forEach((tr) => {
        const cells = [...tr.querySelectorAll(".au-cell")];
        const row = {};
        columns.forEach((c, i) => {
          let cell = (cells[i]?.value ?? "").trim().replace(/\n/g, "<br>");
          // normalise every gap marker style to sequential ___qN___
          cell = cell.replace(/___q\d+___|(?<!_)\d+\s*_{2,}|_{3,}/g, () => {
            gapCount += 1;
            return `___q${gapCount}___`;
          });
          row[colKey(c)] = cell;
        });
        if (Object.values(row).some((v) => v !== "")) rows.push(row);
      });
      if (!rows.length) fail("at least one row is required.");
      if (!gapCount) fail("no gaps found — put ___q1___ or 1____ where students type.");
      // answers typed against q1..qN of THIS table; variants keep commas
      const pairs = [];
      val(el, ".au-table-answers").split(",").forEach((seg) => {
        if (seg.includes("=")) pairs.push(seg);
        else if (pairs.length) pairs[pairs.length - 1] += `,${seg}`;
      });
      const answer = {};
      pairs.forEach((pair) => {
        const eq = pair.indexOf("=");
        const k = pair.slice(0, eq).trim();
        const v = pair.slice(eq + 1).trim();
        if (!k || !v) return;
        const num = parseInt(k.replace(/\D/g, ""), 10);
        if (!num || num > gapCount) fail(`answer key "${k}" does not match any gap (this table has q1–q${gapCount}).`);
        answer[`q${num}`] = v;
      });
      for (let n = 1; n <= gapCount; n++) {
        if (!answer[`q${n}`]) fail(`gap q${n} has no answer — add "q${n}=..." to the answers field.`);
      }
      return { type: "table", groupInstruction: gi, title: val(el, ".au-title"), columns, rows, answer };
    }

    case "drag-slots": {
      const items = collectDdItems(el, fail);
      const slots = [];
      el.querySelectorAll(".au-dd-slots .au-sub-row").forEach((row, i) => {
        const label = row.querySelector(".au-slot-label")?.value?.trim() ?? "";
        const correctId = row.querySelector(".au-slot-correct")?.value?.trim()?.toUpperCase();
        if (!label && !correctId) return;
        if (!correctId) fail(`slot ${i + 1} has no correct card.`);
        if (!items.some((it) => it.id === correctId)) fail(`slot ${i + 1}: card "${correctId}" is not in the bank.`);
        slots.push({ slotId: `s${slots.length + 1}`, label, correctId });
      });
      if (!slots.length) fail("at least one slot is required.");
      return {
        type: "drag_drop", groupInstruction: gi,
        title: val(el, ".au-title"), question: val(el, ".au-text"),
        items, slots,
      };
    }

    case "drag-inline": {
      const items = collectDdItems(el, fail);
      const inlineText = need(val(el, ".au-inline-text"), "text with {0} gaps");
      const gapCount = (inlineText.match(/\{(\d+)\}/g) || []).length;
      if (!gapCount) fail("no {0} gaps found in the text.");
      const correct = need(val(el, ".au-inline-correct"), "correct cards list")
        .split(",").map((a) => a.trim().toUpperCase()).filter(Boolean);
      if (correct.length !== gapCount) fail(`the text has ${gapCount} gaps but ${correct.length} correct cards are listed.`);
      correct.forEach((c) => {
        if (!items.some((it) => it.id === c)) fail(`correct card "${c}" is not in the bank.`);
      });
      return {
        type: "drag_drop", groupInstruction: gi,
        title: val(el, ".au-title"), inlineText,
        items, slots: correct.map((correctId) => ({ correctId })),
      };
    }

    case "map-labelling": {
      const options = collectOptionRows(el, true);
      if (!Object.keys(options).length) fail("location letters are required.");
      const questions = [];
      el.querySelectorAll(".au-subs .au-sub-row").forEach((row) => {
        const text = row.querySelector(".au-sub-text")?.value?.trim();
        const answer = row.querySelector(".au-sub-answer")?.value?.trim()?.toUpperCase();
        if (!text && !answer) return;
        if (!text || !answer) fail("every label needs both a name and a letter.");
        if (!options[answer]) fail(`label letter "${answer}" is not among the locations.`);
        questions.push({ text, correctAnswer: answer });
      });
      if (!questions.length) fail("at least one label is required.");
      return {
        type: "map-labelling", groupInstruction: gi,
        title: val(el, ".au-title"), imageUrl: val(el, ".au-image-url"),
        options, questions,
      };
    }

    default:
      fail("unknown question kind.");
  }
}

function collectDdItems(el, fail) {
  const items = [];
  el.querySelectorAll(".au-dd-items .au-opt-row").forEach((row) => {
    const id = row.querySelector(".au-dd-id")?.value?.trim()?.toUpperCase();
    const text = row.querySelector(".au-dd-text")?.value?.trim();
    if (!id && !text) return;
    if (!id || !text) fail("every card needs both a letter and a text.");
    if (items.some((i) => i.id === id)) fail(`duplicate card letter "${id}".`);
    items.push({ id, text });
  });
  if (items.length < 2) fail("at least two cards are required.");
  return items;
}

/* ───────────── generic add-row handling (one listener per tool) ───────────── */

// Call once per page: wires every "+ Add ..." button inside author forms.
export function setupAuthorForms(root = document) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".au-add-row");
    if (!btn) return;
    const item = btn.closest(".au-item");
    const add = btn.dataset.add;
    if (add === "option") {
      btn.previousElementSibling?.insertAdjacentHTML?.("beforeend", optionRows([{ label: "", text: "" }]));
    } else if (add === "sub") {
      item.querySelector(".au-subs")?.insertAdjacentHTML(
        "beforeend",
        `<div class="au-sub-row">
          <input type="text" class="au-sub-text form-input" placeholder="Question / statement / label">
          <input type="text" class="au-sub-answer form-input" placeholder="Answer (A, B...)">
          <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
        </div>`
      );
    } else if (add === "dd-item") {
      item.querySelector(".au-dd-items")?.insertAdjacentHTML(
        "beforeend",
        `<div class="au-opt-row">
          <input type="text" class="au-dd-id form-input" placeholder="C">
          <input type="text" class="au-dd-text form-input" placeholder="Card text">
          <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
        </div>`
      );
    } else if (add === "dd-slot") {
      item.querySelector(".au-dd-slots")?.insertAdjacentHTML(
        "beforeend",
        `<div class="au-sub-row">
          <input type="text" class="au-slot-label form-input" placeholder="Slot label">
          <input type="text" class="au-slot-correct form-input" placeholder="Correct card (A, B...)">
          <button type="button" class="au-remove" onclick="this.parentElement.remove()">×</button>
        </div>`
      );
    } else if (add === "table-row") {
      const head = item.querySelectorAll(".au-table-head .au-col").length;
      item.querySelector(".au-table-body")?.insertAdjacentHTML(
        "beforeend",
        `<tr class="au-table-row">${Array.from({ length: head })
          .map(() => `<td><textarea class="au-cell form-input" rows="2" placeholder="Cell text"></textarea></td>`)
          .join("")}<td><button type="button" class="au-remove" onclick="this.closest('tr').remove()">×</button></td></tr>`
      );
    } else if (add === "table-col") {
      item.querySelector(".au-table-head")?.querySelector("th:last-child")
        ?.insertAdjacentHTML("beforebegin", `<th><input type="text" class="au-col form-input" placeholder="Column"></th>`);
      item.querySelectorAll(".au-table-body .au-table-row").forEach((tr) => {
        tr.querySelector("td:last-child")?.insertAdjacentHTML(
          "beforebegin",
          `<td><textarea class="au-cell form-input" rows="2" placeholder="Cell text"></textarea></td>`
        );
      });
    }
  });
}

// Collect every author form inside a container, in DOM order.
export function collectAll(container, target, labelPrefix = "") {
  const out = [];
  container.querySelectorAll(".au-item").forEach((el, i) => {
    out.push(collectEditor(el, target, `${labelPrefix}item ${i + 1}`));
  });
  return out;
}
