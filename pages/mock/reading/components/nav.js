// The bottom bar: one block per part. The part you are on shows its
// question numbers; the others fold down to "Part 2   3 of 13", as in the
// real computer-delivered test. Built from each test's own numbering, so a
// test split 14 / 13 / 13 is no longer drawn as 13 / 13 / 14.
import { readingState } from "./state.js";
import { answeredMap } from "./questions.js";

let partsHost = null;

export function buildFooter({ onPart, onQuestion }) {
  partsHost = document.getElementById("cdParts");
  partsHost.innerHTML = "";

  readingState.parts.forEach((part) => {
    const block = document.createElement("section");
    block.className = "cd-part";
    block.dataset.part = String(part.index);

    const head = document.createElement("button");
    head.type = "button";
    head.className = "cd-part-btn";
    head.innerHTML =
      `<span class="cd-part-name">Part ${part.index + 1}</span>` +
      `<span class="cd-part-count" aria-live="polite"></span>`;
    head.addEventListener("click", () => onPart(part.index));

    const nums = document.createElement("div");
    nums.className = "cd-qnums";
    nums.setAttribute("role", "group");
    nums.setAttribute("aria-label", `Part ${part.index + 1} questions`);
    part.qIds.forEach((qId) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cd-qnum";
      b.dataset.q = qId;
      b.textContent = qId.slice(1);
      b.setAttribute("aria-label", `Question ${qId.slice(1)}`);
      b.addEventListener("click", () => onQuestion(qId));
      nums.appendChild(b);
    });

    block.append(head, nums);
    partsHost.appendChild(block);
  });
}

/** Brings every marker up to date. Cheap: at most forty buttons. */
export function updateFooter() {
  if (!partsHost) return;
  const s = readingState.session;
  const answered = answeredMap(readingState.items, s.answers);
  const flags = new Set(s.flags);

  partsHost.querySelectorAll(".cd-part").forEach((block) => {
    const index = Number(block.dataset.part);
    const part = readingState.parts[index];
    const done = part.qIds.filter((q) => answered[q]).length;
    block.classList.toggle("is-active", index === s.part);
    const count = block.querySelector(".cd-part-count");
    const label = `${done} of ${part.qIds.length}`;
    if (count.textContent !== label) count.textContent = label;

    block.querySelectorAll(".cd-qnum").forEach((b) => {
      const q = b.dataset.q;
      b.classList.toggle("answered", !!answered[q]);
      b.classList.toggle("review", flags.has(q));
      b.classList.toggle("current", q === s.current);
      b.setAttribute("aria-current", q === s.current ? "true" : "false");
    });
  });

  const review = document.getElementById("reviewToggle");
  if (review) review.checked = !!(s.current && flags.has(s.current));
}
