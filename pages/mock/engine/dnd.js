// ═══════════════════════════════════════════════════════════════════════
// Question engine — drag & drop renderers (CDT-style interactions).
//
//   drag-slots   drag cards from a bank onto labelled slots — used for
//                matching headings, matching features, sentence endings
//   drag-inline  drag words from a bank into {0} gaps inside a text —
//                used for word-bank summary completion
//
// Answers: per-slot slots ({qId}) store one item id per question id;
// legacy grouped slots store one {slotId: itemId} object under groupId.
// Click-to-place works alongside dragging: click a bank card, then click
// a slot (keyboards/touchpads without drag support stay usable).
// ═══════════════════════════════════════════════════════════════════════

function bankCardHTML(item) {
  return (
    `<div class="dd-item" draggable="true" data-item-id="${item.id}" tabindex="0">` +
    `<span class="dd-item-label">${item.id}</span>` +
    `<span class="dd-item-text">${item.text}</span></div>`
  );
}

function readAnswers(item, ctx) {
  // → {slotKey: itemId}; slotKey = qId (per-slot) or slotId (grouped)
  if (item.storage === "per-slot") {
    const map = {};
    item.slots.forEach((s) => {
      const v = ctx.answers?.[s.qId];
      if (v) map[s.qId] = v;
    });
    return map;
  }
  const stored = ctx.answers?.[item.groupId];
  return stored && typeof stored === "object" ? { ...stored } : {};
}

function writeSlot(item, ctx, slot, itemId) {
  if (item.storage === "per-slot") {
    ctx.onAnswer(slot.qId, itemId); // undefined clears
  } else {
    const stored = readAnswers(item, ctx);
    if (itemId === undefined) delete stored[slot.slotId];
    else stored[slot.slotId] = itemId;
    ctx.onAnswer(item.groupId, stored);
  }
}

const slotKey = (item, slot) => (item.storage === "per-slot" ? slot.qId : slot.slotId);

/* ── drag-slots (cards onto labelled slots) ── */
export function renderDragSlots(item, ctx) {
  const div = document.createElement("div");
  div.className = "question-item qe-drag-slots";
  if (item.storage === "grouped" && item.groupId) div.id = item.groupId;

  div.innerHTML =
    `<div class="dd-question-text">${item.question || item.title || ""}</div>` +
    `<div class="dd-layout"><div class="dd-items-bank"></div><div class="dd-slots-container">` +
    item.slots
      .map((s) => {
        const num = s.qId ? String(s.qId).replace(/\D/g, "") : "";
        return (
          `<div class="dd-slot" data-slot-key="${slotKey(item, s)}"` +
          (s.qId ? ` id="${s.qId}"` : "") +
          `><div class="dd-slot-label">${num ? `<span class="dd-slot-num">${num}</span> ` : ""}${s.label || ""}</div>` +
          `<div class="dd-slot-drop-zone"></div></div>`
        );
      })
      .join("") +
    `</div></div>`;

  wireDnd(div, item, ctx);
  return div;
}

/* ── drag-inline (words into {0} gaps inside a text) ── */
export function renderDragInline(item, ctx) {
  const div = document.createElement("div");
  div.className = "question-item qe-drag-inline";

  div.innerHTML =
    `<div class="dd-inline-wrapper">` +
    (item.title ? `<div class="dd-question-title">${item.title}</div>` : "") +
    `<div class="dd-items-bank"></div>` +
    `<div class="dd-inline-paragraph">` +
    item.inlineText.replace(/\{(\d+)\}/g, (m, idx) => {
      const slot = item.slots[parseInt(idx, 10)];
      if (!slot) return m;
      const num = String(slot.qId || "").replace(/\D/g, "");
      return (
        `<span class="dd-slot dd-inline-slot" data-slot-key="${slotKey(item, slot)}" id="${slot.qId || ""}">` +
        `<span class="dd-slot-num">${num}</span>` +
        `<span class="dd-slot-drop-zone"></span></span>`
      );
    }) +
    `</div></div>`;

  wireDnd(div, item, ctx);
  return div;
}

/* ── shared interaction: drag, drop, click-to-place, refresh ── */
function wireDnd(root, item, ctx) {
  let dragId = null;
  let dragFromKey = null;
  let clickArmedId = null;

  const bank = root.querySelector(".dd-items-bank");

  function refresh() {
    const placed = readAnswers(item, ctx);
    const placedIds = new Set(Object.values(placed));

    bank.innerHTML = item.items.filter((i) => !placedIds.has(i.id)).map(bankCardHTML).join("");
    bank.querySelectorAll(".dd-item").forEach((card) => {
      card.addEventListener("dragstart", () => { dragId = card.dataset.itemId; dragFromKey = null; });
      card.addEventListener("click", () => {
        clickArmedId = clickArmedId === card.dataset.itemId ? null : card.dataset.itemId;
        bank.querySelectorAll(".dd-item").forEach((c) =>
          c.classList.toggle("dd-armed", c.dataset.itemId === clickArmedId)
        );
      });
    });

    root.querySelectorAll(".dd-slot").forEach((slotEl) => {
      const key = slotEl.dataset.slotKey;
      const zone = slotEl.querySelector(".dd-slot-drop-zone");
      const itemId = placed[key];
      const placedItem = itemId ? item.items.find((i) => i.id === itemId) : null;
      zone.innerHTML = placedItem
        ? `<span class="dd-placed-item" draggable="true" data-item-id="${placedItem.id}">` +
          `<span class="dd-item-label">${placedItem.id}</span>` +
          `<span class="dd-item-text">${placedItem.text}</span></span>`
        : "";
      const placedEl = zone.querySelector(".dd-placed-item");
      if (placedEl) {
        placedEl.addEventListener("dragstart", (e) => {
          dragId = placedEl.dataset.itemId; dragFromKey = key; e.stopPropagation();
        });
        placedEl.addEventListener("click", (e) => {
          // click a placed card → send it back to the bank
          e.stopPropagation();
          writeSlot(item, ctx, slotOfKey(key), undefined);
          refresh();
        });
      }
    });
  }

  const slotOfKey = (key) => item.slots.find((s) => slotKey(item, s) === key);

  function place(targetKey) {
    const target = slotOfKey(targetKey);
    if (!target) return;
    const placed = readAnswers(item, ctx);
    const existing = placed[targetKey];
    if (dragFromKey !== null && dragFromKey !== targetKey) {
      // moving between slots — swap if the target was occupied
      writeSlot(item, ctx, slotOfKey(dragFromKey), existing || undefined);
    }
    writeSlot(item, ctx, target, dragId);
    refresh();
  }

  root.querySelectorAll(".dd-slot").forEach((slotEl) => {
    slotEl.addEventListener("dragover", (e) => e.preventDefault());
    slotEl.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragId) return;
      place(slotEl.dataset.slotKey);
      dragId = null; dragFromKey = null;
    });
    slotEl.addEventListener("click", () => {
      if (!clickArmedId) return;
      dragId = clickArmedId; dragFromKey = null;
      clickArmedId = null;
      place(slotEl.dataset.slotKey);
      dragId = null;
    });
  });

  bank.addEventListener("dragover", (e) => e.preventDefault());
  bank.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!dragId || dragFromKey === null) return;
    writeSlot(item, ctx, slotOfKey(dragFromKey), undefined);
    dragId = null; dragFromKey = null;
    refresh();
  });

  refresh();
}
