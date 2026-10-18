// Analyse mode's controls, for every account: pause and resume, ten
// seconds back or forward, and the recording's bar, which moves the
// recording wherever it is clicked.
//
// Pausing opens no panel: the test simply stands still. The recording
// stops, the stopwatch stops and shows a pause sign, and the button reads
// "Resume"; pressing it carries everything on from the same second.
import { listeningState } from "./state.js?v=3.4";
import { position, recordingLength, trackStart, started, SKIP_MS } from "./audio.js?v=3.4";

const fmt = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5v14M15 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';

/** player — from createPlayer(); onPause() — redraw the clock at once */
export function initPlayerControls({ player, onPause }) {
  const pauseBtn = document.getElementById("pauseBtn");
  const bar = document.getElementById("playerBar");
  const track = document.getElementById("playerTrack");
  const fill = document.getElementById("playerFill");
  const timeEl = document.getElementById("playerTime");

  pauseBtn.hidden = false;
  bar.hidden = false;

  // where each part's recording begins, as ticks on the bar
  let lastTotal = -1;
  const drawTicks = () => {
    track.querySelectorAll(".player-tick").forEach((t) => t.remove());
    const total = recordingLength();
    if (!total) return;
    listeningState.tracks.forEach((t, k) => {
      if (!k) return;
      const tick = document.createElement("span");
      tick.className = "player-tick";
      tick.style.left = `${(trackStart(k) / total) * 100}%`;
      tick.title = `Part ${t.part + 1}`;
      track.appendChild(tick);
    });
  };

  let shownPaused = null;
  const update = () => {
    const paused = player.paused;
    if (paused !== shownPaused) {
      shownPaused = paused;
      document.body.classList.toggle("paused", paused);
      pauseBtn.innerHTML = `${paused ? ICON_PLAY : ICON_PAUSE}<span class="cd-control-label">${paused ? "Resume" : "Pause"}</span>`;
      pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    }
    const total = recordingLength();
    if (total !== lastTotal) { lastTotal = total; drawTicks(); }
    const pos = Math.min(position(), total);
    fill.style.width = total ? `${(pos / total) * 100}%` : "0%";
    track.setAttribute("aria-valuenow", String(Math.round(pos / 1000)));
    track.setAttribute("aria-valuemax", String(Math.round(total / 1000)));
    track.setAttribute("aria-valuetext", `${fmt(pos)} of ${fmt(total)}`);
    timeEl.textContent = `${fmt(started() ? pos : 0)} / ${fmt(total)}`;
  };

  const toggle = () => {
    if (player.paused) player.resume();
    else player.pause();
    update();
    onPause?.();
  };
  pauseBtn.addEventListener("click", toggle);

  document.getElementById("rewindBtn").addEventListener("click", () => { player.skip(-SKIP_MS); update(); });
  document.getElementById("forwardBtn").addEventListener("click", () => { player.skip(SKIP_MS); update(); });

  track.addEventListener("click", (e) => {
    const total = recordingLength();
    if (!total || !started()) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    player.seekTo(ratio * total);
    update();
  });
  // the bar works from the keyboard too: arrows move ten seconds
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); player.skip(-SKIP_MS); update(); }
    if (e.key === "ArrowRight") { e.preventDefault(); player.skip(SKIP_MS); update(); }
  });

  update();
  return { update };
}
