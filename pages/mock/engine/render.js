// ═══════════════════════════════════════════════════════════════════════
// Question engine — render: one renderer per canonical kind, shared by
// the standalone listening test, the standalone reading test and the
// full mock. Emits the same class names the pages already style
// (question-item, question-number, radio-option, gap-inline, ...), so
// each page's existing CSS keeps working.
//
// ctx = {
//   answers,                    // the page's live answers object
//   onAnswer(qId, value),       // value === undefined → delete
// }
// Engine inputs never rely on the pages' delegated listeners: every
// control gets its own handler that calls ctx.onAnswer. Text inputs are
// marked data-qe so pages' delegated handlers can skip them.
// ═══════════════════════════════════════════════════════════════════════
import { renderDragSlots, renderDragInline } from "./dnd.js";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

const answerOf = (ctx, id) => {
  const v = ctx.answers?.[id];
  return v === null || v === undefined ? "" : v;
};

/* ── content (title / subheading / text / reading text-question) ── */
function renderContent(item) {
  if (item.variant === "title")
    return el("h3", "qe-title text-title", item.text);
  if (item.variant === "subheading")
    return el("h4", "listening-subheading", item.text);
  if (item.variant === "text-question") {
    const div = el("div", "question-item text-item qe-text-question");
    if (item.title) div.appendChild(el("h3", "", item.title));
    if (item.subtitle) div.appendChild(el("h4", "", item.subtitle));
    if (item.text) div.appendChild(el("p", "", `<em>${item.text}</em>`));
    return div;
  }
  return el("p", "listening-text text-paragraph", item.text);
}

/* ── gap: dark number box fused to the input, inline at the blank ── */
export function gapInlineHTML(id, number, value) {
  return (
    `<span class="gap-inline"><span class="gap-num">${number}</span>` +
    `<input type="text" data-qid="${id}" data-question-id="${id}" data-qe="1" class="gap-fill-input gap-fill" placeholder=" " value="${esc(value)}" /></span>`
  );
}

function renderGap(item, ctx) {
  const div = el("div", "question-item gap-fill-item qe-gap");
  div.id = item.id;
  const gap = gapInlineHTML(item.id, item.number, answerOf(ctx, item.id));
  const blankRe = /(\d+)\s*_+|_+\s*(\d+)|_+/; // first blank marker only
  let html = blankRe.test(item.text)
    ? item.text.replace(blankRe, gap)
    : `${item.text} ${gap}`;
  if (item.postfix) html += ` <span class="gap-postfix">${item.postfix}</span>`;
  div.innerHTML = `<div class="question-text">${html}</div>`;
  wireTextInputs(div, ctx);
  return div;
}

/* ── gap-group: reading completion block (header + gap list) ── */
function renderGapGroup(item, ctx) {
  const section = el("div", "gap-fill-section qe-gap-group");
  const h = item.header;
  if (h?.title) section.appendChild(el("div", "gap-fill-title", h.title));
  if (h?.info) section.appendChild(el("div", "gap-fill-info", h.info));
  if (h?.subtitle) section.appendChild(el("div", "gap-fill-subtitle", h.subtitle));

  const list = el("div", "gap-fill-questions");
  const bulletRe = /^[•●]\s*/;
  const hasBullets = item.gaps.some((g) => bulletRe.test(g.text));

  item.gaps.forEach((g) => {
    const row = el("div", hasBullets ? "gap-fill-list-item" : "gap-fill-question");
    row.id = g.id;
    const value = answerOf(ctx, g.id);
    const input =
      `<input type="text" id="input-${g.id}" class="gap-fill-input gap-fill${value ? " has-value" : ""}"` +
      ` placeholder="${g.number}" data-question-id="${g.id}" data-qid="${g.id}" data-qe="1" value="${esc(value)}" />`;
    const text = g.text.replace(bulletRe, "");
    const html = /\.{3,}|_{3,}|…+/.test(text)
      ? text.replace(/\.{3,}|_{3,}|…+/g, input)
      : `${text} ${input}`;
    if (hasBullets) {
      row.innerHTML =
        `<span class="gap-fill-list-bullet"></span>` +
        `<div class="gap-fill-content-wrapper"><span class="gap-fill-text">${html}</span></div>`;
    } else {
      row.innerHTML = `<span class="gap-fill-text">${html}</span>`;
    }
    list.appendChild(row);
  });

  section.appendChild(list);
  wireTextInputs(section, ctx, true);
  return section;
}

/* ── choice: radio group (MC / TFNG / YNNG) ── */
function renderChoice(item, ctx) {
  const div = el("div", "question-item qe-choice");
  div.id = item.id;
  const saved = answerOf(ctx, item.id);
  const opts = item.options
    .map((o) => {
      const label = o.text ? `${o.label}. ${o.text}` : o.label;
      return (
        `<label class="radio-option"><input type="radio" name="${item.id}" value="${esc(o.label)}" data-qe="1" ${
          saved === o.label ? "checked" : ""
        }/> ${label}</label>`
      );
    })
    .join("");
  div.innerHTML =
    `<div class="question-number">${item.number}</div>` +
    `<div class="question-text">${item.text}<div class="radio-group">${opts}</div></div>`;
  div.querySelectorAll('input[type="radio"]').forEach((r) =>
    r.addEventListener("change", () => ctx.onAnswer(item.id, r.value))
  );
  return div;
}

/* ── match: one dropdown against shared options ── */
function renderMatch(item, ctx) {
  const div = el("div", "question-item qe-match");
  div.id = item.id;
  const saved = answerOf(ctx, item.id);
  const opts = item.options
    .map(
      (o) =>
        `<option value="${esc(o.label)}" ${saved === o.label ? "selected" : ""}>${o.label}${o.text ? `: ${o.text}` : ""}</option>`
    )
    .join("");
  div.innerHTML =
    `<div class="question-number">${item.number}</div>` +
    `<div class="question-text">${item.text}</div>` +
    `<select data-qid="${item.id}" id="${item.id}" class="select-input matching-select" data-qe="1">` +
    `<option value="">Choose option</option>${opts}</select>`;
  div.querySelector("select").addEventListener("change", (e) =>
    ctx.onAnswer(item.id, e.target.value)
  );
  return div;
}

/* ── match-group: options box + rows of dropdowns ── */
function renderMatchGroup(item, ctx) {
  const div = el("div", "matching-group qe-match-group");
  if (item.groupId) div.id = item.groupId;
  const optionRows = item.options
    .map((o) => `<p class="matching-option-row" style="margin: 5px 0;"><strong>${o.label}</strong> ${o.text}</p>`)
    .join("");
  div.innerHTML =
    `<div class="matching-options-box">` +
    `${item.stem ? `<p class="group-stem">${item.stem}</p>` : ""}${optionRows}</div>`;
  item.rows.forEach((r) => {
    const saved = answerOf(ctx, r.id);
    const rowDiv = el("div", "matching-question");
    rowDiv.id = r.id;
    rowDiv.innerHTML =
      `<div class="question-number">${r.number}</div>` +
      `<div class="matching-question-text">${r.text}</div>` +
      `<select data-qid="${r.id}" class="matching-select" data-qe="1"><option value="">Select...</option>` +
      item.options
        .map(
          (o) =>
            `<option value="${esc(o.label)}" ${saved === o.label ? "selected" : ""}>${o.label}${o.text ? `. ${o.text}` : ""}</option>`
        )
        .join("") +
      `</select>`;
    rowDiv.querySelector("select").addEventListener("change", (e) =>
      ctx.onAnswer(r.id, e.target.value)
    );
    div.appendChild(rowDiv);
  });
  return div;
}

/* ── multi-select: "choose TWO/THREE" checkbox bank ── */
// Selected letters are distributed to the sub-question ids in sorted
// order, so grading never depends on click order.
function renderMultiSelect(item, ctx) {
  const div = el("div", "multi-select-group qe-multi-select");
  if (item.groupId) div.id = item.groupId;
  const max = item.max || item.subs.length || 2;
  const subIds = item.subs.map((s) => s.id);
  const selectedNow = () => subIds.map((id) => ctx.answers?.[id]).filter(Boolean);

  div.innerHTML =
    `<div class="multi-select-box" data-qe-group="${item.groupId || ""}">` +
    (item.heading ? `<h4 class="qe-ms-heading">${item.heading}</h4>` : "") +
    (item.stem ? `<p class="group-stem">${item.stem}</p>` : "") +
    `<div class="selection-counter">Selected: <span class="qe-ms-counter">${selectedNow().length}</span> / ${max}</div>` +
    `<div class="radio-group">` +
    item.options
      .map(
        (o) =>
          `<label class="radio-option"><input type="checkbox" value="${esc(o.label)}" data-qe="1" ${
            selectedNow().includes(o.label) ? "checked" : ""
          }/> ${o.label}. ${o.text}</label>`
      )
      .join("") +
    `</div></div>`;

  // hidden markers so question nav can scroll to sub ids
  subIds.forEach((id) => {
    const marker = el("div");
    marker.id = id;
    marker.style.display = "none";
    div.appendChild(marker);
  });

  const counter = div.querySelector(".qe-ms-counter");
  const boxes = [...div.querySelectorAll('input[type="checkbox"]')];
  boxes.forEach((cb) =>
    cb.addEventListener("change", () => {
      let checked = boxes.filter((b) => b.checked).map((b) => b.value);
      if (checked.length > max) {
        cb.checked = false;
        alert(`You can only select ${max} options.`);
        checked = boxes.filter((b) => b.checked).map((b) => b.value);
      }
      checked.sort();
      subIds.forEach((id, i) => ctx.onAnswer(id, checked[i]));
      counter.textContent = String(checked.length);
    })
  );
  return div;
}

/* ── table: completion table with marker gaps in cells ── */
function renderTable(item, ctx) {
  const div = el("div", "table-group qe-table");
  const re = new RegExp(item.markerRe, "g");
  const gapify = (content) =>
    String(content).replace(re, (_, captured) => {
      const id = captured.startsWith("q") || captured.startsWith("reading_") ? captured : `q${captured}`;
      const number = String(id).replace(/\D/g, "");
      return gapInlineHTML(id, number, answerOf(ctx, id));
    });

  let html = item.title ? `<h4 style="margin-bottom: 15px;">${item.title}</h4>` : "";
  html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><thead><tr>`;
  item.columns.forEach((col) => {
    html += `<th style="border: 1px solid #ddd; padding: 12px 8px; background: #f8f9fa; font-weight: bold; text-align: left;">${col}</th>`;
  });
  html += `</tr></thead><tbody>`;

  item.rows.forEach((row, i) => {
    html += `<tr style="background: ${i % 2 === 0 ? "#ffffff" : "#f8f9fa"};">`;
    if (item.tableStyle === "reading") {
      html += `<td style="border: 1px solid #ddd; padding: 12px 8px; font-weight: bold; background: #f1f3f4;">${row.column || ""}</td>`;
      item.columns.slice(1).forEach((col) => {
        html += `<td style="border: 1px solid #ddd; padding: 12px 8px; vertical-align: top;">${gapify(row[col.toLowerCase()] || "")}</td>`;
      });
    } else {
      item.columns.forEach((col) => {
        const key = col.toLowerCase().replace(/\s+/g, "");
        html += `<td style="border: 1px solid #ddd; padding: 12px 8px; vertical-align: top;">${gapify(row[key] || "")}</td>`;
      });
    }
    html += `</tr>`;
  });
  html += `</tbody></table>`;
  div.innerHTML = html;
  wireTextInputs(div, ctx);
  return div;
}

/* ── map-labelling: image + numbered label rows with letter dropdowns ── */
function renderMapLabelling(item, ctx) {
  const div = el("div", "qe-map-labelling");
  if (item.groupId) div.id = item.groupId;
  div.innerHTML =
    (item.title ? `<h4 class="qe-map-title">${item.title}</h4>` : "") +
    (item.imageUrl
      ? `<div class="qe-map-image"><img src="${esc(item.imageUrl)}" alt="${esc(item.title || "Plan")}" /></div>`
      : "");
  const letters = item.options.length
    ? item.options
    : [...new Set(item.rows.flatMap((r) => r.answerKey))].sort().map((l) => ({ label: l, text: "" }));
  item.rows.forEach((r) => {
    const saved = answerOf(ctx, r.id);
    const rowDiv = el("div", "matching-question");
    rowDiv.id = r.id;
    rowDiv.innerHTML =
      `<div class="question-number">${r.number}</div>` +
      `<div class="matching-question-text">${r.text}</div>` +
      `<select data-qid="${r.id}" class="matching-select" data-qe="1"><option value="">Select...</option>` +
      letters
        .map(
          (o) =>
            `<option value="${esc(o.label)}" ${saved === o.label ? "selected" : ""}>${o.label}${o.text ? `. ${o.text}` : ""}</option>`
        )
        .join("") +
      `</select>`;
    rowDiv.querySelector("select").addEventListener("change", (e) =>
      ctx.onAnswer(r.id, e.target.value)
    );
    div.appendChild(rowDiv);
  });
  return div;
}

/* ── shared: per-input listeners for typed gaps ── */
function wireTextInputs(root, ctx, sizeClasses = false) {
  root.querySelectorAll('input[type="text"][data-qid]').forEach((input) => {
    const id = input.dataset.qid;
    input.addEventListener("input", (e) => {
      ctx.onAnswer(id, e.target.value);
      if (!sizeClasses) return;
      if (e.target.value.trim()) {
        input.classList.add("has-value");
        const len = e.target.value.length;
        input.classList.remove("input-small", "input-medium", "input-large");
        input.classList.add(len > 15 ? "input-large" : len > 8 ? "input-medium" : "input-small");
      } else {
        input.classList.remove("has-value", "input-small", "input-medium", "input-large");
      }
    });
    input.addEventListener("focus", () => input.classList.add("focused"));
    input.addEventListener("blur", () => input.classList.remove("focused"));
  });
}

/* ── public API ── */
export function renderItem(item, container, ctx) {
  let node = null;
  switch (item.kind) {
    case "content": node = renderContent(item); break;
    case "gap": node = renderGap(item, ctx); break;
    case "gap-group": node = renderGapGroup(item, ctx); break;
    case "choice": node = renderChoice(item, ctx); break;
    case "match": node = renderMatch(item, ctx); break;
    case "match-group": node = renderMatchGroup(item, ctx); break;
    case "multi-select": node = renderMultiSelect(item, ctx); break;
    case "table": node = renderTable(item, ctx); break;
    case "drag-slots": node = renderDragSlots(item, ctx); break;
    case "drag-inline": node = renderDragInline(item, ctx); break;
    case "map-labelling": node = renderMapLabelling(item, ctx); break;
    default: return null;
  }
  if (node && container) container.appendChild(node);
  return node;
}
