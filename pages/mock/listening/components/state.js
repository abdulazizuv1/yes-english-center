export const listeningState = {
  app: null,
  db: null,
  auth: null,

  sections: [],
  currentSectionIndex: 0,
  answersSoFar: {},

  currentAudio: null,
  currentAudioSection: 0,
  audioInitialized: false,
  audioCurrentTime: 0,

  isPaused: false,
  pausedTime: 0,
  timerStartTime: null,
  hasUnlimitedTime: false,

  currentQuestionNumber: 1,

  savedHighlights: {},

  // timer interval id
  timerIntervalKey: "listeningTimerInterval",
};


