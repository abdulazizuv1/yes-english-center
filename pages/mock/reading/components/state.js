// Shared state for one sitting of the reading test.
//
// Everything a student produces (answers, highlights, notes, review flags,
// the part they are on, the clock) lives in `session`, and the session is
// written to this computer's storage on every change. The rest is derived
// from the test document and rebuilt on each load.
export const readingState = {
  testId: "test-1",
  user: null,          // { uid, email, label }
  passages: [],        // the test document's passages, numbered q1..qN
  parts: [],           // [{ index, qIds: [...], first, last }]
  items: [],           // engine items per part, normalized once
  session: null,       // see session.js
  unlimited: false,    // staff accounts sit the test without a clock
};
