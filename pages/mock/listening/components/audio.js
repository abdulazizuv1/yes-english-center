import { listeningState } from "./state.js";

export function handleAudio(section, index) {
  if (listeningState.audioInitialized) return;

  const container = document.getElementById("audio-container");
  if (!container) return;

  initializeSequentialAudio();
  listeningState.audioInitialized = true;
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

    const label = `Section ${sectionIndex + 1} Audio`;

    if (listeningState.isAdmin) {
      container.innerHTML = `
        <audio controls autoplay style="width:100%; margin-bottom:20px;" id="sectionAudio">
          <source src="${section.audioUrl}" type="audio/mpeg" />
        </audio>
        <div style="text-align:center; margin-top:10px; color:#6b7280;">${label}</div>
      `;
    } else {
      container.innerHTML = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px;">
          <div style="font-size:13px; color:#6b7280; margin-bottom:12px; text-align:center;">${label}</div>
          <audio id="sectionAudio" autoplay>
            <source src="${section.audioUrl}" type="audio/mpeg" />
          </audio>
          <div style="display:flex; align-items:center; justify-content:center; gap:16px;">
            <button id="studentPlayPauseBtn" style="padding:8px 22px; border:none; border-radius:8px; background:#3b82f6; color:#fff; font-size:14px; cursor:pointer; min-width:90px;">⏸ Pause</button>
            <span id="studentAudioTime" style="font-size:13px; color:#374151; font-variant-numeric:tabular-nums; min-width:90px;">0:00 / 0:00</span>
          </div>
        </div>
      `;
      setupStudentAudioControls();
    }

    listeningState.currentAudio = document.getElementById("sectionAudio");
    listeningState.currentAudioSection = sectionIndex;

    if (listeningState.currentAudio) {
      listeningState.currentAudio.addEventListener("ended", () => {
        setTimeout(() => playAudioForSection(sectionIndex + 1), 1000);
      });
    }
  }
}

function setupStudentAudioControls() {
  const audio = document.getElementById("sectionAudio");
  const playPauseBtn = document.getElementById("studentPlayPauseBtn");
  const timeDisplay = document.getElementById("studentAudioTime");
  if (!audio) return;

  let lastValidTime = 0;

  function fmt(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  audio.addEventListener("timeupdate", () => {
    if (!audio.seeking) lastValidTime = audio.currentTime;
    timeDisplay.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  });

  // Block seeking
  audio.addEventListener("seeking", () => {
    audio.currentTime = lastValidTime;
  });

  audio.addEventListener("play", () => { playPauseBtn.textContent = "⏸ Pause"; });
  audio.addEventListener("pause", () => { playPauseBtn.textContent = "▶ Play"; });

  playPauseBtn.addEventListener("click", () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });
}


