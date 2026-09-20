// The test clock.
//
// It counts against a deadline saved when the test starts, not against the
// moment the page loaded. That is why a refresh no longer hands the student
// a fresh hour, and why losing the internet changes nothing: the time left
// is always the deadline minus now. Like the real computer-delivered test
// it shows whole minutes, and it flashes as it crosses 10 and 5 minutes.
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
