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

    container.innerHTML = `
            <audio controls autoplay style="width:100%; margin-bottom: 20px;" id="sectionAudio">
                <source src="${section.audioUrl}" type="audio/mpeg" />
                Your browser does not support the audio element.
            </audio>
            <div style="text-align: center; margin-top: 10px; color: #6b7280;">
                Playing: Section ${sectionIndex + 1} Audio
            </div>
        `;

    listeningState.currentAudio = document.getElementById("sectionAudio");
    listeningState.currentAudioSection = sectionIndex;

    if (listeningState.currentAudio) {
      listeningState.currentAudio.addEventListener("ended", () => {
        setTimeout(() => playAudioForSection(sectionIndex + 1), 1000);
      });
    }
  }
}


