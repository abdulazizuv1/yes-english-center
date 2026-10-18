// Everything around the test itself: the menu with text size and colour
// settings (both offered by the real computer-delivered test), the volume
// control, hiding the clock, the connection indicator, and the banners
// that tell the student something has changed.
import { listeningState } from "./state.js?v=3.4";
import { saveSession, onStorageHealth } from "./session.js?v=3.4";

const SIZES = ["standard", "large", "xlarge"];
const CONTRASTS = ["bw", "wb", "yb"];

export function applySettings() {
  const { settings, timerHidden } = listeningState.session;
  document.body.dataset.size = SIZES.includes(settings.size) ? settings.size : "standard";
  document.body.dataset.contrast = CONTRASTS.includes(settings.contrast) ? settings.contrast : "bw";
  document.body.classList.toggle("timer-hidden", !!timerHidden);

  document.querySelectorAll('#menuPanel input[name="size"]').forEach((r) => { r.checked = r.value === document.body.dataset.size; });
  document.querySelectorAll('#menuPanel input[name="contrast"]').forEach((r) => { r.checked = r.value === document.body.dataset.contrast; });
  // analyse mode's clock counts up, so it is "time spent"
  const what = listeningState.mode === "analyse" ? "time spent" : "time remaining";
  const hideBtn = document.getElementById("toggleTimer");
  if (hideBtn) hideBtn.textContent = `${timerHidden ? "Show" : "Hide"} ${what}`;
  const showBtn = document.getElementById("showTimer");
  if (showBtn) showBtn.textContent = `Show ${what}`;
}

/**
 * A line under the header. Each `kind` has its own line, so "no internet"
 * and "check your answers" can both be up at once.
 */
export function banner(kind, message, tone = "warn") {
  const host = document.getElementById("statusBanner");
  let line = host.querySelector(`[data-kind="${kind}"]`);
  if (!message) {
    line?.remove();
    host.hidden = !host.children.length;
    return;
  }
  if (!line) {
    line = document.createElement("div");
    line.dataset.kind = kind;
    host.appendChild(line);
  }
  line.dataset.tone = tone;
  if (line.textContent !== message) line.textContent = message;
  host.hidden = false;
}

/** The volume slider(s): the header one, and the copy in the settings menu. */
export function initVolume({ onVolume }) {
  const sliders = document.querySelectorAll("[data-volume]");
  const icon = document.getElementById("volumeIcon");
  const reflect = (v) => {
    sliders.forEach((s) => { s.value = String(Math.round(v * 100)); });
    document.body.classList.toggle("muted", v === 0);
    icon?.setAttribute("aria-label", `Volume ${Math.round(v * 100)}%`);
  };
  sliders.forEach((s) => {
    s.addEventListener("input", () => {
      const v = Number(s.value) / 100;
      reflect(v);
      onVolume(v);
    });
  });
  reflect(listeningState.session.volume ?? 0.8);
}

export function initChrome() {
  const s = () => listeningState.session;

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
    else if (input.name === "contrast") s().settings.contrast = input.value;
    else return;
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
    banner("store", ok ? "" : "This browser is not saving your answers. Tell your teacher before you continue.", "error");
  });

  /* leaving the page mid-test loses nothing, but it is rarely meant */
  window.addEventListener("beforeunload", (e) => {
    const live = s() && s().anchor != null && !s().finished;
    if (!live) return;          // not started, or submitted and on its way
    e.preventDefault();
    e.returnValue = "";         // browsers show their own wording here
  });
}
