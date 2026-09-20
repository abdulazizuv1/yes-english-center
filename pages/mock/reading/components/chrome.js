// Everything around the test itself: the menu with text size and colour
// settings (both offered by the real computer-delivered test), hiding the
// clock, the connection indicator, a warning if this browser will not save,
// and the divider between passage and questions.
import { readingState } from "./state.js?v=3.2";
import { saveSession, onStorageHealth } from "./session.js?v=3.2";

const SIZES = ["standard", "large", "xlarge"];
const CONTRASTS = ["bw", "wb", "yb"];

export function applySettings() {
  const { settings, timerHidden, split } = readingState.session;
  document.body.dataset.size = SIZES.includes(settings.size) ? settings.size : "standard";
  document.body.dataset.contrast = CONTRASTS.includes(settings.contrast) ? settings.contrast : "bw";
  document.body.classList.toggle("timer-hidden", !!timerHidden);
  document.querySelector(".cd-main")?.style.setProperty("--split", String(split || 0.5));

  document.querySelectorAll('#menuPanel input[name="size"]').forEach((r) => { r.checked = r.value === document.body.dataset.size; });
  document.querySelectorAll('#menuPanel input[name="contrast"]').forEach((r) => { r.checked = r.value === document.body.dataset.contrast; });
  const hideBtn = document.getElementById("toggleTimer");
  if (hideBtn) hideBtn.textContent = timerHidden ? "Show time remaining" : "Hide time remaining";
}

function banner(kind, message) {
  const el = document.getElementById("statusBanner");
  if (!message) {
    if (el.dataset.kind === kind) { el.hidden = true; el.dataset.kind = ""; }
    return;
  }
  el.dataset.kind = kind;
  el.textContent = message;
  el.hidden = false;
}

export function initChrome() {
  const s = () => readingState.session;

  /* menu */
  const menuBtn = document.getElementById("menuBtn");
  const panel = document.getElementById("menuPanel");
  const setOpen = (open) => {
    panel.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(panel.hidden); });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== menuBtn) setOpen(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  panel.addEventListener("change", (e) => {
    const input = e.target;
    if (input.name === "size") s().settings.size = input.value;
    if (input.name === "contrast") s().settings.contrast = input.value;
    saveSession();
    applySettings();
  });

  const toggleTimer = () => {
    s().timerHidden = !s().timerHidden;
    saveSession();
    applySettings();
  };
  document.getElementById("toggleTimer").addEventListener("click", toggleTimer);
  document.getElementById("showTimer").addEventListener("click", toggleTimer);

  /* connection: the page keeps working offline; say so plainly */
  const net = document.getElementById("netIcon");
  const reflectNet = () => {
    const online = navigator.onLine !== false;
    document.body.classList.toggle("offline", !online);
    net.title = online ? "Connected" : "No internet connection";
    net.setAttribute("aria-label", net.title);
    banner("net", online ? "" : "No internet connection. Keep going: every answer is being saved on this computer.");
  };
  window.addEventListener("online", reflectNet);
  window.addEventListener("offline", reflectNet);
  reflectNet();

  /* a browser that refuses to save must not stay silent */
  onStorageHealth((ok) => {
    banner("store", ok ? "" : "This browser is not saving your answers. Tell your teacher before you continue.");
  });

  /* leaving the page mid-test loses nothing, but it is rarely meant */
  window.addEventListener("beforeunload", (e) => {
    const live = readingState.session && !readingState.session.finished;
    if (!live) return;          // submitted: the page is on its way to the result
    e.preventDefault();
    e.returnValue = "";         // browsers show their own wording here
  });

  /* the divider between passage and questions */
  const main = document.querySelector(".cd-main");
  const splitter = document.getElementById("splitter");
  const setSplit = (fraction, save) => {
    const f = Math.min(0.75, Math.max(0.25, fraction));
    s().split = Math.round(f * 1000) / 1000;
    main.style.setProperty("--split", String(s().split));
    if (save) saveSession();
  };
  splitter.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    document.body.classList.add("resizing");
    const rect = main.getBoundingClientRect();
    const move = (ev) => setSplit((ev.clientX - rect.left) / rect.width, false);
    const up = () => {
      splitter.removeEventListener("pointermove", move);
      splitter.removeEventListener("pointerup", up);
      splitter.removeEventListener("pointercancel", up);
      document.body.classList.remove("resizing");
      saveSession();
    };
    splitter.addEventListener("pointermove", move);
    splitter.addEventListener("pointerup", up);
    splitter.addEventListener("pointercancel", up);
  });
  splitter.addEventListener("dblclick", () => setSplit(0.5, true));
  splitter.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); setSplit(s().split - 0.02, true); }
    if (e.key === "ArrowRight") { e.preventDefault(); setSplit(s().split + 0.02, true); }
  });
}
