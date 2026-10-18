// The test clock.
//
// The real computer-delivered test lasts as long as its recording, plus
// two minutes at the end to check answers; there is no transfer time. So
// the time left is read from the recording's timeline (audio.js), not
// from a fixed 40 minutes. Like the real test it shows whole minutes, and
// it flashes as it crosses 10 and 5 minutes.
//
// Analyse mode has no time limit: a stopwatch counts the time spent, and
// while the test is paused it stands still with a pause sign instead of
// the clock face.
const TEN = 10 * 60 * 1000;
const FIVE = 5 * 60 * 1000;

export function formatRemaining(ms) {
  if (ms <= 0) return "0 minutes left";
  const mins = Math.ceil(ms / 60000);
  return `${mins} ${mins === 1 ? "minute" : "minutes"} left`;
}

/**
 * getRemaining — ms left, or null while the recording's length is unknown
 * onExpire     — called once when the time is up
 */
export function startClock({ el, getRemaining, unlimited, onExpire }) {
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
    const left = getRemaining();
    const text = left === null ? "Listening" : formatRemaining(left);
    if (text !== lastText) { lastText = text; el.textContent = text; }
    if (left === null) return;

    const nextStage = left <= FIVE ? 2 : left <= TEN ? 1 : 0;
    if (nextStage !== stage) {
      if (nextStage > stage && !first) flash();   // a reload inside the window keeps the colour, not the alarm
      stage = nextStage;
      el.classList.toggle("low", stage === 2);
    }

    if (left <= 0) {
      expired = true;
      clearInterval(timer);
      onExpire();
    }
  };

  timer = setInterval(tick, 1000);
  tick(true);
  return () => clearInterval(timer);
}

/** 0:42, 12:05, 1:02:09 */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** getElapsed — ms spent; isPaused — the test is paused */
export function startStopwatch({ el, getElapsed, isPaused }) {
  if (!el) return () => {};
  el.classList.add("stopwatch");
  let lastText = "";
  const paint = () => {
    const paused = isPaused();
    el.classList.toggle("is-paused", paused);
    el.title = paused ? "Time spent (paused)" : "Time spent";
    const text = formatElapsed(getElapsed());
    if (text !== lastText) { lastText = text; el.textContent = text; }
  };
  paint();
  // four looks a second, so the seconds roll over evenly and none is skipped
  const timer = setInterval(paint, 250);
  return Object.assign(() => clearInterval(timer), { paint });
}
