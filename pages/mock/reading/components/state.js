// Central state for reading test
export const readingState = {
  currentPassageIndex: 0,
  passages: [],
  answersSoFar: {},
  orderedQIds: [],
  testStorageKey: "readingTest_temp",
  passageHighlights: {},
  questionHighlights: {},
  selectedText: "",
  selectedRange: null,
  highlightEventListeners: [],
  hasUnlimitedTime: false,
  currentTestId: "test-1",
  currentQuestionIndex: 0,
  isPaused: false,
  pausedTime: 0,
};


