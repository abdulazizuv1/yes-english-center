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
// a slot (keyboards, touch screens and touchpads stay usable).
//
// The words on a card can be selected and highlighted, and the card can
// still be dragged from anywhere on it. The browser's own drag (draggable)
// cannot do both, so the drag is done here with pointer events: sweeping
// over the words inside the card selects them, and carrying the pointer out
// past the card's edge picks the card up. A press on the card's letter or
// edge is only ever a drag. Each card's highlights are saved against the
// card (marks.js), so they go wherever it goes.
// ═══════════════════════════════════════════════════════════════════════
import { CARDS_REDRAWN } from "./marks.js?v=3.5";

const CARD = ".dd-item, .dd-placed-item";
const PICK_UP_PX = 4;       // a press on the card's edge: movement before it lifts
const LEAVE_PX = 10;        // a press on its words: how far past the card before it lifts
const RETURN_MS = 320;      // a placed card goes back after one click; a second click
                            // in this time is a double-click on a word instead
const EDGE_PX = 56;         // near a scrolling pane's edge, the pane scrolls

function cardInner(item, group) {
  return (
    `<span class="dd-item-label">${item.id}</span>` +
    `<span class="dd-item-text" data-mark-anchor="${group}/${item.id}">${item.text}</span>`
  );
}

function bankCardHTML(item, group) {
  return `<div class="dd-item" data-item-id="${item.id}" tabindex="0">${cardInner(item, group)}</div>`;
}

function scrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflow = getComputedStyle(p).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
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
  // names this question's cards for their highlights: two questions on one
  // part can both have a card "A"
  const group = item.groupId || item.slots[0]?.qId || item.slots[0]?.slotId || "dd";
  let clickArmedId = null;
  let returnTimer = null;
  let returnKey = null;
  let justDragged = false;

  const bank = root.querySelector(".dd-items-bank");
  const slotOfKey = (key) => item.slots.find((s) => slotKey(item, s) === key);

  function refresh() {
    const placed = readAnswers(item, ctx);
    const placedIds = new Set(Object.values(placed));

    bank.innerHTML = item.items.filter((i) => !placedIds.has(i.id)).map((i) => bankCardHTML(i, group)).join("");

    root.querySelectorAll(".dd-slot").forEach((slotEl) => {
      const zone = slotEl.querySelector(".dd-slot-drop-zone");
      const itemId = placed[slotEl.dataset.slotKey];
      const placedItem = itemId ? item.items.find((i) => i.id === itemId) : null;
      zone.innerHTML = placedItem
        ? `<span class="dd-placed-item" data-item-id="${placedItem.id}">${cardInner(placedItem, group)}</span>`
        : "";
    });

    // the new cards have no highlights yet: marks.js puts them back
    root.dispatchEvent(new CustomEvent(CARDS_REDRAWN, { bubbles: true }));
  }

  /** Puts a card on a slot; `fromKey` is the slot it came from, if any. */
  function place(targetKey, itemId, fromKey = null) {
    const target = slotOfKey(targetKey);
    if (!target) return;
    const existing = readAnswers(item, ctx)[targetKey];
    if (fromKey !== null && fromKey !== targetKey) {
      // moving between slots — swap if the target was occupied
      writeSlot(item, ctx, slotOfKey(fromKey), existing || undefined);
    }
    writeSlot(item, ctx, target, itemId);
    refresh();
  }

  const arm = (itemId) => {
    clickArmedId = itemId;
    bank.querySelectorAll(".dd-item").forEach((c) =>
      c.classList.toggle("dd-armed", c.dataset.itemId === clickArmedId)
    );
  };

  /* ── clicks ── */
  const selecting = () => {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && root.contains(sel.anchorNode);
  };

  // the click that ends a drag belongs to the drag
  root.addEventListener("click", (e) => { if (justDragged) e.stopPropagation(); }, true);

  root.addEventListener("click", (e) => {
    const card = e.target.closest(CARD);
    if (card) {
      // words being selected, or a highlight being clicked (it opens its
      // menu, marks.js): neither is a click on the card
      if (selecting() || e.target.closest("mark.hl")) return;
      if (card.classList.contains("dd-item")) {
        arm(clickArmedId === card.dataset.itemId ? null : card.dataset.itemId);
      } else {
        // click a placed card → send it back to the bank
        const key = card.closest(".dd-slot").dataset.slotKey;
        clearTimeout(returnTimer);
        returnKey = key;
        returnTimer = setTimeout(() => {
          returnKey = null;
          writeSlot(item, ctx, slotOfKey(key), undefined);
          refresh();
        }, RETURN_MS);
      }
      return;
    }
    const slotEl = e.target.closest(".dd-slot");
    if (slotEl && clickArmedId && !selecting()) {
      const itemId = clickArmedId;
      clickArmedId = null;
      place(slotEl.dataset.slotKey, itemId);
    }
  });

  // a double-click selects a word; it neither arms a card nor returns one
  root.addEventListener("dblclick", (e) => {
    if (!e.target.closest(".dd-item-text")) return;
    clearTimeout(returnTimer);
    returnKey = null;
    arm(null);
  });

  /* ── dragging ── */
  // pressing on words already selected would start the browser's text drag
  root.addEventListener("dragstart", (e) => e.preventDefault());

  root.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;   // a finger scrolls; a tap places
    const card = e.target.closest(CARD);
    if (!card) return;
    const key = card.closest(".dd-slot")?.dataset.slotKey ?? null;
    if (key !== null && key === returnKey) {
      // the second press of a double-click
      clearTimeout(returnTimer);
      returnKey = null;
    }
    trackPress(card, e, key);
  });

  function trackPress(card, down, fromKey) {
    const overWords = !!down.target.closest(".dd-item-text");
    const box = card.getBoundingClientRect();
    const grabX = down.clientX - box.left;
    const grabY = down.clientY - box.top;
    let x = down.clientX;
    let y = down.clientY;
    let ghost = null;
    let over = null;
    let scroller = null;
    let scrollTimer = null;

    const carriedOut = () =>
      overWords
        ? x < box.left - LEAVE_PX || x > box.right + LEAVE_PX || y < box.top - LEAVE_PX || y > box.bottom + LEAVE_PX
        : Math.hypot(x - down.clientX, y - down.clientY) >= PICK_UP_PX;

    const pickUp = () => {
      arm(null);
      window.getSelection()?.removeAllRanges();
      document.documentElement.classList.add("dd-dragging");
      card.classList.add("dd-drag-source");
      ghost = card.cloneNode(true);
      ghost.querySelectorAll("[data-mark-anchor]").forEach((el) => el.removeAttribute("data-mark-anchor"));
      ghost.classList.add("dd-ghost");
      ghost.style.width = `${box.width}px`;
      root.appendChild(ghost);
      scroller = scrollParent(root);
      scrollTimer = setInterval(autoScroll, 16);
    };

    const findTarget = () => {
      const under = document.elementFromPoint(x, y);
      const slot = under?.closest(".dd-slot");
      if (slot && root.contains(slot)) return slot;
      // back to the bank: only a card that has left it can return
      return fromKey !== null && under?.closest(".dd-items-bank") === bank ? bank : null;
    };

    const showTarget = () => {
      const target = findTarget();
      if (target === over) return;
      over?.classList.remove("dd-over");
      target?.classList.add("dd-over");
      over = target;
    };

    function autoScroll() {
      const isPage = scroller === document.scrollingElement;
      const top = isPage ? 0 : scroller.getBoundingClientRect().top;
      const bottom = isPage ? window.innerHeight : scroller.getBoundingClientRect().bottom;
      let step = 0;
      if (y < top + EDGE_PX) step = -Math.ceil((top + EDGE_PX - y) / 5);
      else if (y > bottom - EDGE_PX) step = Math.ceil((y - (bottom - EDGE_PX)) / 5);
      if (!step) return;
      scroller.scrollTop += step;
      showTarget();
    }

    const onMove = (e) => {
      // the button came up somewhere we never heard about (outside the window)
      if (e.buttons === 0) { end(); return; }
      x = e.clientX;
      y = e.clientY;
      if (!ghost) {
        if (!carriedOut()) return;      // still a press, or words being selected
        pickUp();
      }
      window.getSelection()?.removeAllRanges();
      ghost.style.left = `${x - grabX}px`;
      ghost.style.top = `${y - grabY}px`;
      showTarget();
    };

    const end = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("keydown", onKey, true);
      clearInterval(scrollTimer);
      if (!ghost) return false;         // it stayed a click or a selection
      ghost.remove();
      card.classList.remove("dd-drag-source");
      over?.classList.remove("dd-over");
      document.documentElement.classList.remove("dd-dragging");
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 60);
      return true;
    };

    function onUp(e) {
      x = e.clientX;
      y = e.clientY;
      const target = ghost ? findTarget() : null;
      if (!end() || !target) return;
      if (target === bank) {
        writeSlot(item, ctx, slotOfKey(fromKey), undefined);
        refresh();
      } else {
        place(target.dataset.slotKey, card.dataset.itemId, fromKey);
      }
    }
    function onCancel() { end(); }
    function onKey(e) { if (e.key === "Escape" && ghost) { e.stopPropagation(); end(); } }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("keydown", onKey, true);
  }

  refresh();
}
