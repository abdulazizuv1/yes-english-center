// "Clear all": empties the sitting back to a blank test, every answer,
// highlight, note and review mark.
//
// In analyse mode every student has it, to do the test again from the
// start (the recording and the stopwatch go back to the beginning too).
// In the mock only staff see it, to check a test again, and the recording
// is left alone. Either way the page asks first, in its own dialog that
// says exactly what will go, because nothing cleared can be brought back.
import { listeningState } from "./state.js?v=3.4";
import { saveSession } from "./session.js?v=3.4";
import { answeredMap } from "./questions.js?v=3.4";

const TOAST_MS = 2600;

function counts() {
  const s = listeningState.session;
  const answered = answeredMap(listeningState.items, s.answers);
  const notes = s.marks.filter((m) => m.note != null).length;
  return [
    [Object.values(answered).filter(Boolean).length, "answer", "answers"],
    [s.marks.length - notes, "highlight", "highlights"],
    [notes, "note", "notes"],
    [s.flags.length, "review mark", "review marks"],
  ];
}

let toastTimer = null;
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;        // restart the fade if one is still running
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; el.classList.remove("show"); }, TOAST_MS);
}

/**
 * resetsClock — say in the dialog that the stopwatch restarts (analyse mode)
 * onCleared   — redraw the page after the sitting is emptied
 */
export function initClear({ resetsClock = false, onCleared }) {
  const btn = document.getElementById("clearBtn");
  const modal = document.getElementById("clearModal");
  const list = modal.querySelector("[data-clear=list]");
  const cancelBtn = modal.querySelector("[data-clear=cancel]");

  btn.hidden = false;
  modal.querySelector("[data-clear=clock]").hidden = !resetsClock;

  const close = () => {
    modal.hidden = true;
    document.removeEventListener("keydown", onKey);
    btn.focus();
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  const open = () => {
    list.replaceChildren(...counts().map(([n, one, many]) => {
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = String(n);
      li.append(b, ` ${n === 1 ? one : many}`);
      li.classList.toggle("none", n === 0);
      return li;
    }));
    modal.hidden = false;
    cancelBtn.focus();        // the safe choice is the one Enter picks
    document.addEventListener("keydown", onKey);
  };

  const clear = () => {
    const s = listeningState.session;
    s.answers = {};
    s.marks = [];
    s.flags = [];
    s.current = null;
    s.scroll = {};
    onCleared();
    saveSession();
    close();
    toast("Everything has been cleared.");
  };

  btn.addEventListener("click", open);
  modal.addEventListener("click", (e) => {
    const act = e.target.closest("[data-clear]")?.dataset.clear;
    if (act === "confirm") clear();
    else if (act === "cancel" || e.target === modal) close();
  });
}
