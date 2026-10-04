// The test clock.
//
// It counts against a deadline saved when the test starts, not against the
// moment the page loaded. That is why a refresh no longer hands the student
// a fresh hour, and why losing the internet changes nothing: the time left
// is always the deadline minus now. Like the real computer-delivered test
// it shows whole minutes, and it flashes as it crosses 10 and 5 minutes.
//
// Analyse mode has no deadline: a stopwatch counts up instead, for as long
// as the student keeps working, and never ends the test.
import { onBeforeSave } from "./session.js?v=3.3";

const TEN = 10 * 60 * 1000;
const FIVE = 5 * 60 * 1000;

export function formatRemaining(ms) {
  if (ms <= 0) return "0 minutes left";
  const mins = Math.ceil(ms / 60000);
  return `${mins} ${mins === 1 ? "minute" : "minutes"} left`;
}

/** Paints the clock as it stood when the test was paused, and stops there. */
export function freezeClock({ el, remaining, unlimited }) {
  if (!el) return;
  el.classList.remove("flash");
  el.textContent = unlimited ? "Untimed" : formatRemaining(remaining);
}

export function startClock({ el, getDeadline, unlimited, onExpire }) {
  if (!el) return () => {};
  if (unlimited) {
    el.textContent = "Untimed";
    el.classList.add("untimed");
    return () => {};
  }

  let expired = false;
  let lastText = "";
  let stage = 0;              // 0 plenty, 1 under ten minutes, 2 under five
  let timer = null;

  const flash = () => {
    el.classList.remove("flash");
    void el.offsetWidth;      // restart the animation if it was mid-way
    el.classList.add("flash");
  };

  const tick = (first = false) => {
    if (expired) return;
    const remaining = getDeadline() - Date.now();

    const text = formatRemaining(remaining);
    if (text !== lastText) {  // write only when it changes
      lastText = text;
      el.textContent = text;
    }

    const nextStage = remaining <= FIVE ? 2 : remaining <= TEN ? 1 : 0;
    if (nextStage > stage) {
      stage = nextStage;
      if (!first) flash();    // a reload inside the window keeps the colour, not the alarm
      el.classList.toggle("low", stage === 2);
    }

    if (remaining <= 0 && !expired) {
      expired = true;
      clearInterval(timer);
      onExpire();
    }
  };

  tick(true);
  // align to the second so the minute rolls over when it should
  const align = 1000 - (Date.now() % 1000);
  const starter = setTimeout(() => {
    tick();
    timer = setInterval(tick, 1000);
  }, align);

  return () => {
    clearTimeout(starter);
    clearInterval(timer);
  };
}

/* ───────────── analyse mode: the stopwatch ───────────── */

// A gap this long between two ticks means the computer was asleep, and
// that was not time spent on the test. (A tab in the background may tick
// only once a minute; that still counts.)
const SLEEP_GAP_MS = 5 * 60 * 1000;
const SAVE_EVERY_MS = 15 * 1000;

/** 0:42, 12:05, 1:02:09 */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Counts the time the test has been open, picking up from earlier visits
 * (session.elapsed). Time with the page closed is not counted. Every save
 * of the sitting carries the time up to that moment, and the stopwatch
 * saves by itself now and then, so a crash costs a few seconds at most.
 */
export function startStopwatch({ el, session, save }) {
  let since = Date.now();     // start of the stretch not yet in session.elapsed
  let last = since;
  let lastSave = since;
  let lastText = "";
  let running = true;

  const elapsed = () => session.elapsed + (running ? Date.now() - since : 0);
  const fold = () => {
    const now = Date.now();
    session.elapsed += now - since;
    since = now;
  };
  onBeforeSave((s) => { if (s === session && running) fold(); });

  const paint = () => {
    const text = formatElapsed(elapsed());
    if (text !== lastText) { lastText = text; el.textContent = text; }
  };

  const tick = () => {
    const now = Date.now();
    if (now - last > SLEEP_GAP_MS) since += now - last;   // asleep: skip the gap
    last = now;
    paint();
    if (now - lastSave >= SAVE_EVERY_MS) { lastSave = now; save(); }
  };

  el.classList.add("stopwatch");
  el.title = "Time spent";
  paint();
  // four looks a second, so the seconds roll over evenly and none is skipped
  const timer = setInterval(tick, 250);

  return {
    stop() {
      if (!running) return;
      fold();
      running = false;
      clearInterval(timer);
      paint();
    },
    /** back to 0:00, as after Clear all */
    reset() {
      session.elapsed = 0;
      since = last = Date.now();
      paint();
    },
  };
}
