import { listeningState } from "./state.js";

export function handleAudio(section, index) {
  if (listeningState.audioInitialized) return;

  const container = document.getElementById("audio-container");
  if (!container) return;

  initializeSequentialAudio();
  listeningState.audioInitialized = true;
}

const AUDIO_ICON_PLAY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
const AUDIO_ICON_PAUSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;

// Same player as the full mock, centred in the top bar: round play/pause,
// current time, progress line, total time — no label text. Students can't
// seek; admins seek by clicking the progress line.
function audioBarHTML(src) {
  return `
    <div class="audio-player">
      <button id="audioPlayPauseBtn" class="audio-play-btn" aria-label="Pause audio">${AUDIO_ICON_PAUSE}</button>
      <span class="audio-time" id="audioTimeCurrent">0:00</span>
      <div class="audio-progress" id="audioProgressTrack"><div class="audio-progress-fill" id="audioProgressFill"></div></div>
      <span class="audio-time total" id="audioTimeTotal">0:00</span>
      <audio id="sectionAudio" autoplay style="display:none;">
        <source src="${src}" type="audio/mpeg" />
      </audio>
    </div>
  `;
}

export function initializeSequentialAudio() {
  const container = document.getElementById("audio-container");
  playAudioForSection(0);

  function playAudioForSection(sectionIndex) {
    if (sectionIndex >= listeningState.sections.length) return;

    const section = listeningState.sections[sectionIndex];
    if (!section.audioUrl) {
      setTimeout(() => playAudioForSection(sectionIndex + 1), 100);
      return;
    }

    if (listeningState.currentAudio) {
      listeningState.currentAudio.pause();
      listeningState.currentAudio = null;
    }

    container.innerHTML = audioBarHTML(section.audioUrl);
    setupAudioBarControls(listeningState.isAdmin);

    listeningState.currentAudio = document.getElementById("sectionAudio");
    listeningState.currentAudioSection = sectionIndex;

    if (listeningState.currentAudio) {
      listeningState.currentAudio.addEventListener("ended", () => {
        setTimeout(() => playAudioForSection(sectionIndex + 1), 1000);
      });
    }
  }
}

function setupAudioBarControls(allowSeek) {
  const audio = document.getElementById("sectionAudio");
  const playPauseBtn = document.getElementById("audioPlayPauseBtn");
  const timeCurrent = document.getElementById("audioTimeCurrent");
  const timeTotal = document.getElementById("audioTimeTotal");
  const track = document.getElementById("audioProgressTrack");
  const progressFill = document.getElementById("audioProgressFill");
  if (!audio) return;

  let lastValidTime = 0;

  function fmt(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = fmt(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.seeking) lastValidTime = audio.currentTime;
    timeCurrent.textContent = fmt(audio.currentTime);
    if (audio.duration) {
      timeTotal.textContent = fmt(audio.duration);
      progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
    }
  });

  if (allowSeek) {
    // Admins may scrub: click anywhere on the progress line
    track.classList.add("seekable");
    track.title = "Click to seek";
    track.addEventListener("click", (e) => {
      if (!audio.duration) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    });
  } else {
    // Students can't rewind or skip ahead
    audio.addEventListener("seeking", () => {
      audio.currentTime = lastValidTime;
    });
  }

  audio.addEventListener("play", () => {
    playPauseBtn.innerHTML = AUDIO_ICON_PAUSE;
    playPauseBtn.setAttribute("aria-label", "Pause audio");
  });
  audio.addEventListener("pause", () => {
    playPauseBtn.innerHTML = AUDIO_ICON_PLAY;
    playPauseBtn.setAttribute("aria-label", "Play audio");
  });

  playPauseBtn.addEventListener("click", () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });
}
