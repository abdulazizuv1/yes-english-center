// Listening audio: one centred player pill, sequential per-section
// playback, admin seek / student seek-block.
import { state } from "./state.js";

// Функция для полной остановки аудио
function stopAllAudio() {
  if (state.currentAudio) {
    state.currentAudio.pause();
    state.currentAudio.currentTime = 0;
    state.currentAudio.src = ""; // Очищаем источник
    state.currentAudio = null;
  }

  // Также останавливаем все аудио элементы на странице
  const allAudio = document.querySelectorAll("audio");
  allAudio.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
    audio.src = "";
  });

  // Очищаем аудио контейнер
  const audioContainer = document.getElementById("audio-container");
  if (audioContainer) {
    audioContainer.innerHTML = "";
  }
}

function handleSectionAudio(section, index) {
  // Если аудио уже инициализировано, не трогаем его при навигации
  if (state.audioInitialized) return;
  
  const container = document.getElementById("audio-container");
  if (!container) return;
  
  // Инициализируем аудио только один раз - начинаем с первой секции
  initializeSequentialAudio();
  state.audioInitialized = true;
}

const AUDIO_ICON_PLAY = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
const AUDIO_ICON_PAUSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>`;

// One player for everyone, centred in the top bar: round play/pause,
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

function initializeSequentialAudio() {
  const container = document.getElementById("audio-container");

  // If we have a single master audio mode
  if (state.stageData.listening.audioUrl && state.stageData.listening.audioMode === 'single') {
    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio = null;
    }
    container.innerHTML = audioBarHTML(state.stageData.listening.audioUrl);
    setupAudioBarControls(state.isAdmin);
    state.currentAudio = document.getElementById('sectionAudio');
    return;
  }

  playAudioForSection(0);

  function playAudioForSection(sectionIndex) {
    if (sectionIndex >= state.stageData.listening.sections.length) return;

    const section = state.stageData.listening.sections[sectionIndex];
    if (!section.audioUrl) {
      setTimeout(() => playAudioForSection(sectionIndex + 1), 100);
      return;
    }

    if (state.currentAudio) {
      state.currentAudio.pause();
      state.currentAudio = null;
    }

    container.innerHTML = audioBarHTML(section.audioUrl);
    setupAudioBarControls(state.isAdmin);

    state.currentAudio = document.getElementById('sectionAudio');
    state.currentAudioSection = sectionIndex;

    if (state.currentAudio) {
      state.currentAudio.addEventListener('ended', () => {
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

// Whitespace/case-insensitive comparison so the same instruction typed with
export { stopAllAudio, handleSectionAudio };
