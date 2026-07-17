// All mutable state shared between full mock modules. One object so any
// module can read and write the same fields without import binding issues.
export const state = {
  testData: null,
  currentStage: "listening", // 'listening', 'reading', 'writing'
  currentStageIndex: 0,
  stageData: {},
  answersSoFar: {},
  currentSectionIndex: 0,
  currentPassageIndex: 0,
  currentQuestionIndex: 0,
  orderedQIds: [],
  // Built by assignReadingQuestionIds so nav counts match the real IDs
  readingPassageCounts: [],
  currentTestId: null,
  currentAudio: null,
  isPaused: false,
  pausedTime: 0,
  timerStartTime: null,
  audioCurrentTime: 0,
  currentAudioSection: 0, // Какая секция аудио сейчас играет
  audioInitialized: false, // Было ли аудио инициализировано
  hasUnlimitedTime: false, // Track if user has unlimited time
  isAdmin: false, // Track if current user is admin

  // Highlight system state
  savedHighlights: {},
  selectedText: "",
  selectedRange: null,
  highlightEventListeners: [],

  // Passage and question highlights for reading
  passageHighlights: {},
  questionHighlights: {},

  // localStorage key (per test id, set in loadTest)
  testStorageKey: "fullmockTest_temp",

  // Restored-session info from localStorage
  savedStage: null,
  savedTimerRemaining: null,
};

export const stageNames = ["listening", "reading", "writing"];

// Stage durations in minutes
export const stageDurations = {
  listening: 40,
  reading: 60,
  writing: 60,
};
