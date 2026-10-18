// The recording, in the test's two modes.
//
// MOCK — the real exam. The recording plays once, from the first part to
// the last; nobody can pause it, rewind it or skip ahead, staff included.
// Where it stands is one moment on the clock, `session.anchor`: the
// instant it would have started had it played without a break, so
// position = now - anchor. Two rules follow:
//   • While the page is open the recording leads. If it stops to buffer,
//     the internet drops or the browser blocks sound, the timeline waits
//     for it (the anchor moves on), so no word is ever skipped.
//   • While the page is closed (a refresh, a crash) time goes on, as it
//     would in the exam room, and the recording picks up where it would
//     be by now. Closing the page is not a way to pause the test.
//
// ANALYSE — practice. Everyone can pause, rewind and skip ahead. Where the
// recording stands is simply kept (`session.pos`), so it waits while the
// page is closed and carries on from the same second. A stopwatch counts
// the time spent and stops while the test is paused.
//
// The old player pulled the audio back to a saved time whenever it was
// resumed, and a guard against seeking pulled it back again, for ever:
// the recording froze or started over. Nothing here fights the player.
import { listeningState } from "./state.js?v=3.4";
import { saveSession } from "./session.js?v=3.4";
import { storedUrl } from "./audioStore.js?v=3.4";

export const GAP_MS = 1000;            // silence between two recording files
export const CHECK_MS = 2 * 60 * 1000; // mock: time to check answers after the recording
export const SKIP_MS = 10 * 1000;      // analyse: one press of rewind / forward
const SLACK_S = 1.5;                   // nearer than this, the audio is where it should be
const TICK_MS = 500;
const SAVE_EVERY_MS = 2000;
const RETRY_MS = 4000;

const sess = () => listeningState.session;
const tracks = () => listeningState.tracks;
export const isAnalyse = () => listeningState.mode === "analyse";

/* ─────────────────────────── the timeline ─────────────────────────── */

function durMs(k) {
  const d = sess().durations[k];
  return Number.isFinite(d) && d > 0 ? d * 1000 : null;
}

/** Where file k starts on the timeline, in ms. */
export function trackStart(k) {
  let t = 0;
  for (let j = 0; j < k; j++) t += (durMs(j) ?? 0) + GAP_MS;
  return t;
}

/** The whole recording, in ms (0 while the files' lengths are unknown). */
export function recordingLength() {
  const n = tracks().length;
  return n ? trackStart(n - 1) + (durMs(n - 1) ?? 0) : 0;
}

export const lengthsKnown = () =>
  tracks().length > 0 && tracks().every((_, k) => durMs(k) !== null);

export const started = () => (isAnalyse() ? sess()?.startedAt != null : sess()?.anchor != null);

/** Where the recording stands, in ms. */
export function position(now = Date.now()) {
  const s = sess();
  if (!s) return 0;
  if (isAnalyse()) return s.pos || 0;
  return s.anchor == null ? 0 : now - s.anchor;
}

/** Mock: time left in the test, the rest of the recording plus checking time. */
export const remaining = (now) => recordingLength() + CHECK_MS - position(now);

export const recordingOver = (now) => started() && lengthsKnown() && position(now) >= recordingLength();

function locate(pos) {
  const n = tracks().length;
  for (let k = 0; k < n; k++) {
    const start = trackStart(k);
    if (pos < start) return { k, wait: start - pos };   // the silence before file k
    const d = durMs(k);
    if (d === null || pos < start + d) return { k, offset: Math.max(0, (pos - start) / 1000) };
  }
  return { done: true };
}

/* ───────────────────── before the test: file lengths ───────────────────── */

function probeDuration(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    let timer = null;
    const done = (value) => {
      clearTimeout(timer);
      a.removeAttribute("src");
      resolve(value);
    };
    timer = setTimeout(() => done(null), 20000);
    a.addEventListener("loadedmetadata", () => done(Number.isFinite(a.duration) ? a.duration : null), { once: true });
    a.addEventListener("error", () => done(null), { once: true });
    storedUrl(url).then((src) => { a.src = src || url; });
  });
}

/** Learns how long each file is (needed for the clock). True when all are known. */
export async function measureTracks() {
  const s = sess();
  await Promise.all(tracks().map(async (t, k) => {
    if (durMs(k) !== null) return;
    const d = await probeDuration(t.url);
    if (d) s.durations[k] = d;
  }));
  saveSession();
  return lengthsKnown();
}

/* ─────────────────────────── the player ─────────────────────────── */

/**
 * onPartStart(part) — a part's recording has just begun from its start
 * onDone()          — the recording is over
 * onBlocked(bool)   — mock: the browser wants a click before it plays sound
 * onChange()        — something worth redrawing (clock, bar, footer)
 */
export function createPlayer({ onPartStart, onDone, onBlocked, onChange }) {
  const analyse = isAnalyse();
  const el = new Audio();
  el.preload = "auto";
  el.volume = clamp(sess().volume);

  let k = -1;              // the file loaded into the player
  let wanted = false;      // the recording should be sounding now
  let gapTimer = null;     // waiting out the silence between files
  let inGap = false;
  let pendingSeek = null;  // where to start once the file's header is in
  let doneFired = false;
  let blocked = false;
  let ticker = null;
  let lastTick = Date.now();
  let lastSeen = -1;
  let lastSaved = 0;
  let retryTimer = null;
  let syncing = null;
  let again = false;
  let follow = false;      // bring up the playing part's questions (after a seek)

  function clamp(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8;
  }

  /** Analyse: the test is paused (by the student, or because sound was refused). */
  function setPaused(paused) {
    const s = sess();
    if (s.paused === paused) return;
    s.paused = paused;
    if (paused) { wanted = false; inGap = false; clearTimeout(gapTimer); el.pause(); }
    saveSession();
    onChange?.();
  }

  function play() {
    const p = el.play();
    if (!p || !p.then) return;
    p.then(() => {
      if (blocked) { blocked = false; onBlocked?.(false); }
    }).catch((err) => {
      if (err?.name !== "NotAllowedError" || !wanted) return;   // AbortError: a newer file replaced this one
      if (analyse) {
        // the browser wants a click first: the test simply shows as paused
        setPaused(true);
      } else {
        blocked = true;
        onBlocked?.(true);
      }
    });
  }

  async function load(next, offset) {
    k = next;
    const url = tracks()[next].url;
    const src = (await storedUrl(url)) || url;
    pendingSeek = offset > 0.25 ? offset : null;
    el.src = src;
  }

  function finishRecording({ natural }) {
    wanted = false;
    inGap = false;
    clearTimeout(gapTimer);
    el.pause();
    if (natural) {
      if (analyse) sess().pos = recordingLength();
      else sess().anchor = Date.now() - recordingLength();   // checking time starts now
      saveSession();
    }
    if (!doneFired) { doneFired = true; onDone?.(); }
    onChange?.();
  }

  function waitThenSync(ms) {
    inGap = true;
    wanted = false;
    el.pause();
    clearTimeout(gapTimer);
    gapTimer = setTimeout(() => { inGap = false; sync(); }, Math.max(0, ms));
  }

  async function doSync() {
    const s = sess();
    if (!started() || !tracks().length || (analyse && s.paused)) {
      wanted = false;
      el.pause();
      return;
    }
    if (inGap) return;
    const loc = locate(position());
    if (loc.done) { finishRecording({ natural: false }); return; }
    doneFired = false;
    if (loc.wait !== undefined) {
      if (!analyse) { waitThenSync(loc.wait); return; }
      s.pos = trackStart(loc.k);           // a seek into the silence: start the next file
      loc.offset = 0;
    }

    wanted = true;
    const fresh = loc.k !== k || el.error || !el.currentSrc;
    if (fresh) await load(loc.k, loc.offset);
    else if (el.readyState >= 1 && Math.abs(el.currentTime - loc.offset) > SLACK_S) el.currentTime = loc.offset;
    if (follow || (fresh && loc.offset < SLACK_S)) onPartStart?.(tracks()[loc.k].part);
    follow = false;
    play();
    onChange?.();
  }

  /** Puts the player where the timeline says. Safe to call any time. */
  function sync() {
    if (syncing) { again = true; return syncing; }
    syncing = doSync().finally(() => {
      syncing = null;
      if (again) { again = false; sync(); }
    });
    return syncing;
  }

  /* ── what the audio element reports ── */

  el.addEventListener("loadedmetadata", () => {
    const s = sess();
    if (k >= 0 && Number.isFinite(el.duration) && el.duration > 0 && s.durations[k] !== el.duration) {
      s.durations[k] = el.duration;
      saveSession();
    }
    if (pendingSeek !== null) {
      const to = pendingSeek;
      pendingSeek = null;
      if (Number.isFinite(el.duration) && to >= el.duration - 0.25) afterTrack();
      else el.currentTime = to;
    }
  });

  el.addEventListener("timeupdate", () => {
    if (!wanted || el.paused || el.seeking || k < 0 || pendingSeek !== null) return;
    const at = trackStart(k) + el.currentTime * 1000;
    if (analyse) sess().pos = at;
    else sess().anchor = Date.now() - at;      // while it sounds, the recording is the clock
  });

  function afterTrack() {
    if (k < 0) return;
    const end = trackStart(k) + (durMs(k) ?? el.currentTime * 1000);
    if (k + 1 >= tracks().length) { finishRecording({ natural: true }); return; }
    if (analyse) sess().pos = trackStart(k + 1);
    else sess().anchor = Date.now() - end;
    saveSession();
    waitThenSync(GAP_MS);
  }

  el.addEventListener("ended", () => { if (wanted) afterTrack(); });

  // Something outside the page stopped the sound: a media key, the
  // browser's media controls, headphones pulled out.
  el.addEventListener("pause", () => {
    if (!wanted || el.ended) return;          // our own pauses clear `wanted` first
    if (analyse) { setPaused(true); return; } // in practice that is simply a pause
    // in the mock the recording does not stop for that: carry on
    setTimeout(() => {
      if (wanted && el.paused && !el.ended && !syncing) play();
    }, 300);
  });

  // a file that will not load (no internet): try again from the same spot
  el.addEventListener("error", () => {
    if (!wanted) return;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { k = -1; sync(); }, RETRY_MS);
  });
  window.addEventListener("online", () => {
    if (wanted && (el.error || el.paused)) { k = -1; sync(); }
  });

  /* ── the timeline ── */

  function tick() {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    const s = sess();
    if (!started() || !tracks().length) { onChange?.(); return; }

    if (analyse) {
      // the stopwatch runs unless the test is paused; a sleeping computer
      // is not time spent
      if (!s.paused && dt < 60000) s.elapsed = (s.elapsed || 0) + dt;
    } else if (!inGap && !doneFired) {
      if (dt > 60000) {
        // the computer slept: like a closed page, the time has gone
        k = -1;
        sync();
        return;
      }
      const sounding = wanted && !el.paused && !el.seeking && el.readyState >= 3 && el.currentTime !== lastSeen;
      lastSeen = el.currentTime;
      if (!sounding) s.anchor += dt;            // the timeline waits for the recording
    }
    if (now - lastSaved >= SAVE_EVERY_MS) { lastSaved = now; saveSession(); }
    onChange?.();
  }

  /* ── the browser's media controls and the keyboard's media keys ── */
  if ("mediaSession" in navigator) {
    const handlers = analyse
      ? {
          play: () => api.resume(),
          pause: () => api.pause(),
          seekbackward: () => api.skip(-SKIP_MS),
          seekforward: () => api.skip(SKIP_MS),
        }
      : {};
    for (const action of ["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"]) {
      // in the mock every control does nothing: no pause, no skipping
      try { navigator.mediaSession.setActionHandler(action, handlers[action] || (analyse ? null : () => {})); } catch { /* not supported */ }
    }
  }

  const api = {
    /** Starts (or picks up) the recording. Call from a click when possible. */
    run() {
      if (!ticker) { lastTick = Date.now(); ticker = setInterval(tick, TICK_MS); }
      return sync();
    },
    /** Mock: a click on "Continue" after the browser blocked the sound. */
    unblock() {
      if (wanted) play();
      else sync();
    },
    /** The part whose recording is playing, when the files are per part. */
    playingPart() {
      if (!started() || doneFired || k < 0 || tracks().length < 2) return null;
      if (analyse && sess().paused) return null;
      return tracks()[k].part;
    },
    setVolume(v) {
      el.volume = clamp(v);
      sess().volume = el.volume;
      saveSession();
    },

    /* analyse only */
    get paused() { return !!sess().paused; },
    pause() {
      if (!analyse || !started()) return;
      setPaused(true);
    },
    resume() {
      if (!analyse || !started()) return;
      setPaused(false);
      lastTick = Date.now();
      sync();
    },
    /** `show`: bring up the questions of the part it lands in (a click on the bar) */
    seekTo(pos, { show = true } = {}) {
      if (!analyse || !started()) return;
      const s = sess();
      s.pos = Math.max(0, Math.min(recordingLength(), pos));
      inGap = false;
      clearTimeout(gapTimer);
      doneFired = false;
      follow = show;
      saveSession();
      if (s.paused) { onChange?.(); return; }   // stays paused; lined up on resume
      sync();
    },
    skip(deltaMs) {
      api.seekTo(position() + deltaMs, { show: false });
    },
    /** Back to the start, paused, the stopwatch at 0:00 (after "Clear all"). */
    reset() {
      if (!analyse) return;
      const s = sess();
      s.elapsed = 0;
      setPaused(true);
      api.seekTo(0);
    },

    stop() {
      wanted = false;
      clearInterval(ticker);
      clearTimeout(gapTimer);
      clearTimeout(retryTimer);
      el.pause();
    },
  };
  return api;
}

/* ─────────────────────── the sound check (before the test) ─────────────────────── */

let tone = null;
/** A short tone at the chosen volume, to check the headphones. */
export function playTestTone(volume) {
  try {
    tone = tone || new (window.AudioContext || window.webkitAudioContext)();
    const osc = tone.createOscillator();
    const gain = tone.createGain();
    const t0 = tone.currentTime;
    const level = 0.25 * Math.max(0, Math.min(1, volume));
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(level, t0 + 0.05);
    gain.gain.setValueAtTime(level, t0 + 1.1);
    gain.gain.linearRampToValueAtTime(0, t0 + 1.3);
    osc.connect(gain).connect(tone.destination);
    osc.start(t0);
    osc.stop(t0 + 1.35);
  } catch { /* no Web Audio: nothing to play */ }
}
