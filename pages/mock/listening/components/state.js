// Shared state for one sitting of the listening test.
//
// Everything a student produces (answers, highlights, notes, review flags,
// the part they are on, where the recording is) lives in `session`, and
// the session is written to this computer's storage on every change. The
// rest is derived from the test document and rebuilt on each load.
export const listeningState = {
  testId: "test-1",
  mode: "mock",        // "mock": the real exam; "analyse": pause and rewind, see init.js
  user: null,          // { uid, email }
  title: "",
  sections: [],        // the test document's sections (parts)
  parts: [],           // [{ index, qIds: [...], first, last }]
  items: [],           // engine items per part, normalized once
  tracks: [],          // the recording's files in order: [{ url, part }]
  session: null,       // see session.js
  unlimited: false,    // staff accounts sit the test without a clock
  isAdmin: false,      // admin accounts get "Clear all" in the mock
};
