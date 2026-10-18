// The bottom bar: one block per part. The part on screen shows its
// question numbers; the others fold down to "Part 2   3 of 10", as in the
// real computer-delivered test. The part whose recording is playing
// carries a small speaker.
import { listeningState } from "./state.js?v=3.4";
import { answeredMap } from "./questions.js?v=3.4";

let partsHost = null;

const SPEAKER =
  '<svg class="cd-part-playing" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
  '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>' +
  '<path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export function buildFooter({ onPart, onQuestion }) {
  partsHost = document.getElementById("cdParts");
  partsHost.innerHTML = "";

  listeningState.parts.forEach((part) => {
    const block = document.createElement("section");
    block.className = "cd-part";
    block.dataset.part = String(part.index);

    const head = document.createElement("button");
    head.type = "button";
    head.className = "cd-part-btn";
    head.innerHTML =
      `<span class="cd-part-name">Part ${part.index + 1}</span>${SPEAKER}` +
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
  const s = listeningState.session;
  const answered = answeredMap(listeningState.items, s.answers);
  const flags = new Set(s.flags);

  partsHost.querySelectorAll(".cd-part").forEach((block) => {
    const index = Number(block.dataset.part);
    const part = listeningState.parts[index];
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

/** Marks the part whose recording is playing (null: none, or one file for all). */
export function markPlayingPart(index) {
  if (!partsHost) return;
  partsHost.querySelectorAll(".cd-part").forEach((block) => {
    const playing = Number(block.dataset.part) === index;
    if (block.classList.contains("is-playing") !== playing) block.classList.toggle("is-playing", playing);
  });
}
