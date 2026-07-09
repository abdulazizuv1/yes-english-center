/**
 * Study plan assembly — deterministic. Claude only supplies skill weights,
 * weekly focus topics and advice; every date, task and test link is built
 * here so the schedule can never be hallucinated.
 *
 * Every study day trains all four skills (Listening, Reading, Writing,
 * Speaking). The day is assembled against a minute budget (hoursPerDay):
 * each skill gets a "main" block — either a real site test or a rotating
 * practice variant — then extras fill the remaining time.
 */

const DAY_MS = 86400000;

// Parse "YYYY-MM-DD" at UTC noon so date math never crosses DST/timezone edges
function parseDate(str) {
  return new Date(`${str}T12:00:00Z`);
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

// Same raw-score → band table the dashboard uses (useResults.js)
export function bandFromScore(score, total) {
  const n = Math.round((score / (total || 40)) * 40);
  if (n >= 39) return 9.0;
  if (n >= 37) return 8.5;
  if (n >= 35) return 8.0;
  if (n >= 33) return 7.5;
  if (n >= 30) return 7.0;
  if (n >= 27) return 6.5;
  if (n >= 23) return 6.0;
  if (n >= 19) return 5.5;
  if (n >= 15) return 5.0;
  if (n >= 13) return 4.5;
  if (n >= 10) return 4.0;
  return 3.5;
}

export function clampBand(value) {
  const n = Math.round(parseFloat(value) * 2) / 2;
  if (Number.isNaN(n)) return null;
  return Math.min(9, Math.max(3.5, n));
}

const SECTIONS = ["listening", "reading", "writing", "speaking"];

export function validatePlanInput({ currentBands, targetBand, examDate, hoursPerDay, startDate }) {
  const bands = {};
  for (const s of SECTIONS) {
    const b = clampBand(currentBands?.[s]);
    if (b === null) return { error: "invalid_band" };
    bands[s] = b;
  }
  const target = clampBand(targetBand);
  if (target === null) return { error: "invalid_band" };

  // Overall current level = section average rounded to the nearest 0.5
  const avg = SECTIONS.reduce((sum, s) => sum + bands[s], 0) / SECTIONS.length;
  const currentBand = Math.round(avg * 2) / 2;

  // All four skills are trained daily, so the realistic floor is 3 hours
  const hours = Math.min(6, Math.max(3, parseFloat(hoursPerDay)));
  if (Number.isNaN(hours)) return { error: "invalid_hours" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) {
    return { error: "invalid_date" };
  }
  const start = parseDate(startDate);
  const exam = parseDate(examDate);
  const days = Math.round((exam - start) / DAY_MS);
  if (days < 3) return { error: "exam_too_soon" };
  if (days > 200) return { error: "exam_too_far" };

  return {
    currentBands: bands, currentBand, targetBand: target,
    examDate, startDate, hoursPerDay: hours, totalDays: days,
  };
}

/* ─── Estimated minutes per task type (shown in the UI and reminders) ─── */
export const TASK_MINUTES = {
  reading: 60,
  listening: 35,
  writing: 60,
  fullmock: 165,
  vocabulary: 20,
  grammar: 20,
  review: 25,
  mock_review: 30,
  reading_analysis: 30,
  reading_practice: 25,
  listening_review: 20,
  listening_practice: 20,
  writing_practice: 30,
  speaking: 20,
  rest: 0,
};

/* ─── Fallback personalization when Claude is unavailable ───
   Weight = how far each section is from target (weaker → more sessions).
   Prefers real recent test scores; falls back to self-assessed bands. */
export function fallbackWeights(skillStats, currentBands, targetBand) {
  const weightFor = (assessed, tested) => {
    const level = typeof tested === "number" ? tested : assessed;
    const gap = targetBand - level;
    return Math.min(2, Math.max(0.5, 1 + gap * 0.25));
  };
  return {
    reading: weightFor(currentBands.reading, skillStats?.reading?.avgBand),
    listening: weightFor(currentBands.listening, skillStats?.listening?.avgBand),
    writing: weightFor(currentBands.writing, null),
    speaking: weightFor(currentBands.speaking, null),
  };
}

const DEFAULT_FOCUSES = [
  { theme: "Foundations & test format", vocabTopic: "Education & studying", grammarTopic: "Tenses overview" },
  { theme: "Skimming & scanning", vocabTopic: "Environment", grammarTopic: "Complex sentences" },
  { theme: "Paraphrasing & synonyms", vocabTopic: "Technology", grammarTopic: "Passive voice" },
  { theme: "Time management", vocabTopic: "Health & lifestyle", grammarTopic: "Conditionals" },
  { theme: "Question-type strategies", vocabTopic: "Work & careers", grammarTopic: "Relative clauses" },
  { theme: "Coherence & linking", vocabTopic: "Culture & society", grammarTopic: "Linking devices" },
  { theme: "Accuracy under pressure", vocabTopic: "Travel & globalisation", grammarTopic: "Articles" },
  { theme: "Full-test stamina", vocabTopic: "Science & research", grammarTopic: "Modal verbs" },
];

/* ─── Practice variant rotors: consecutive days always look different ─── */
const SPEAKING_PROMPTS = [
  "Speaking Part 1: record yourself — hometown, work, hobbies",
  "Speaking Part 2: 2-minute cue card, record and listen back",
  "Speaking Part 3: discuss opinions out loud for 10 minutes",
  "Speaking: describe a chart or photo aloud for 2 minutes",
  "Speaking: shadow a native speaker for 15 minutes",
  "Speaking Part 1: family, weather, food — record your answers",
  "Speaking Part 2: describe a person you admire (cue card)",
  "Speaking: retell today's reading passage in your own words",
  "Speaking Part 3: agree/disagree questions — give full answers",
  "Speaking: record yourself, then note 5 grammar slips you made",
];

const READING_PRACTICE = [
  { type: "reading_analysis", title: "Reading analysis: keywords & answer locations", minutes: 30 },
  { type: "reading_practice", title: "Timed skimming: read an article in 3 minutes, summarise it", minutes: 25 },
  { type: "reading_practice", title: "Paraphrase hunt: find 10 synonym pairs in a passage", minutes: 25 },
  { type: "reading_practice", title: "True/False/Not Given drill: explain WHY for each answer", minutes: 30 },
];

const LISTENING_PRACTICE = [
  { type: "listening_review", title: "Listening review: replay and transcribe hard sections", minutes: 20 },
  { type: "listening_practice", title: "Dictation: write down 10 sentences from a podcast", minutes: 20 },
  { type: "listening_practice", title: "Shadow a TED talk for 15 minutes", minutes: 20 },
  { type: "listening_practice", title: "Number & spelling drill: names, dates, phone numbers", minutes: 20 },
];

const WRITING_PRACTICE = [
  { type: "writing_practice", title: "Timed Task 1: 150-word report in 20 minutes", minutes: 25 },
  { type: "writing_practice", title: "Timed Task 2: full essay in 40 minutes", minutes: 40 },
  { type: "writing_practice", title: "Rewrite your weakest paragraph from your last essay", minutes: 25 },
  { type: "writing_practice", title: "Outline 3 Task 2 essays: thesis + main ideas only", minutes: 25 },
  { type: "writing_practice", title: "Task 1 vocabulary: 15 trend phrases with examples", minutes: 25 },
];

/**
 * Build the day-by-day plan.
 *
 * @param {object} input     validated plan input
 * @param {object} ai        { skillWeights, weeklyFocuses, advice } from Claude or fallback
 * @param {object} tests     { reading: [testIds], listening: [...], writing: [...], fullmock: [...] }
 * @param {object} taken     { reading: Set(testIds already completed), ... }
 * @returns {{ days: Array, totalTasks: number, weeks: number }}
 */
export function buildPlan(input, ai, tests, taken) {
  const { startDate, totalDays, hoursPerDay, targetBand } = input;
  const start = parseDate(startDate);
  const weeks = Math.ceil(totalDays / 7);
  const budget = hoursPerDay * 60;
  const MAX_TASKS = hoursPerDay >= 5 ? 10 : 8;

  const weights = ai?.skillWeights || {};
  const focuses = Array.isArray(ai?.weeklyFocuses) && ai.weeklyFocuses.length > 0
    ? ai.weeklyFocuses
    : DEFAULT_FOCUSES;

  // Full mock cadence: far out — every 2nd Saturday; close to exam — weekly
  const mockEveryWeek = weeks <= 8 || targetBand >= 7.5;

  // Rotating test queues, already-taken tests go to the back of the queue
  const queues = {};
  for (const type of ["reading", "listening", "writing", "fullmock"]) {
    const all = tests[type] || [];
    const fresh = all.filter((id) => !taken[type]?.has(id));
    const done = all.filter((id) => taken[type]?.has(id));
    queues[type] = { items: [...fresh, ...done], next: 0, freshCount: fresh.length };
  }

  let taskSeq = 0;
  const rotors = { speaking: 0, reading: 0, listening: 0, writing: 0 };

  const takeTest = (type, label) => {
    const q = queues[type];
    if (!q.items.length) return null;
    const testId = q.items[q.next % q.items.length];
    const isRepeat = q.next >= q.freshCount;
    q.next++;
    const num = testId.match(/\d+/)?.[0] || "";
    return {
      id: `t${++taskSeq}`,
      kind: "site",
      type,
      testId,
      title: `${label} Test ${num}${isRepeat ? " (repeat)" : ""}`.trim(),
      minutes: TASK_MINUTES[type] || 30,
      status: "pending",
    };
  };

  const external = (type, title, minutes) => ({
    id: `t${++taskSeq}`,
    kind: "external",
    type,
    title,
    minutes: minutes ?? TASK_MINUTES[type] ?? 20,
    status: "pending",
  });

  const fromRotor = (skill, list) => {
    const v = list[rotors[skill] % list.length];
    rotors[skill]++;
    return external(v.type, v.title, v.minutes);
  };

  const speakingTask = () =>
    external("speaking", SPEAKING_PROMPTS[rotors.speaking++ % SPEAKING_PROMPTS.length]);

  // How often each skill gets a REAL site test (in days): weak skills test
  // more often. Higher hours also mean more frequent testing.
  const gapFor = (skill) => {
    const w = weights[skill] ?? 1;
    if (hoursPerDay >= 5) return w >= 1.25 ? 1 : 2;
    if (hoursPerDay >= 4) return w >= 1.25 ? 1 : 2;
    return w >= 1.25 ? 2 : 3;
  };
  const gaps = { listening: gapFor("listening"), reading: gapFor("reading"), writing: gapFor("writing") };
  // Start negative so the very first days include real tests
  const lastTest = { listening: -9, reading: -9, writing: -9 };

  // Weakest input skill gets the bonus test slot on high-hour plans
  const weakestInput = (weights.reading ?? 1) >= (weights.listening ?? 1) ? "reading" : "listening";

  const days = [];
  let totalTasks = 0;
  let mockYesterday = false;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start.getTime() + i * DAY_MS);
    const weekIndex = Math.floor(i / 7);
    const dow = date.getUTCDay(); // 0=Sun .. 6=Sat
    const focus = focuses[weekIndex % focuses.length];
    const daysLeft = totalDays - i;
    const tasks = [];
    let used = 0;
    let mockToday = false;

    const push = (task) => {
      if (!task) return false;
      if (tasks.length >= MAX_TASKS) return false;
      if (used + task.minutes > budget + 15) return false; // small overflow tolerance
      tasks.push(task);
      used += task.minutes;
      return true;
    };

    if (daysLeft === 1) {
      // Day before the exam: recovery, light speaking + vocabulary only
      push(external("rest", "Rest day — no tests today, sleep early", 0));
      push(speakingTask());
      push(external("vocabulary", `Light review: ${focus.vocabTopic || "vocabulary"}`, 20));
    } else if (dow === 6 && (mockEveryWeek || weekIndex % 2 === 1) && daysLeft > 3) {
      // Mock Saturday: the mock itself covers L+R+W under exam conditions
      const mock = takeTest("fullmock", "Full Mock");
      if (mock) {
        push(mock);
        mockToday = true;
        push(speakingTask());
        push(external("vocabulary", `Vocabulary: ${focus.vocabTopic || "topic review"}`));
        push(external("grammar", `Grammar: ${focus.grammarTopic || "review"}`));
      }
    }

    if (!tasks.length) {
      // Regular day (incl. non-mock Saturdays and Sundays):
      // every skill gets a main block — site test when its cadence is due,
      // otherwise a rotating practice variant.
      if (dow === 0) {
        // Sunday opens with review
        push(mockYesterday
          ? external("mock_review", "Review yesterday's mock: analyse every mistake")
          : external("review", "Review this week's mistakes and notes"));
      }

      // Listening main
      if (i - lastTest.listening >= gaps.listening && push(takeTest("listening", "Listening"))) {
        lastTest.listening = i;
      } else {
        push(fromRotor("listening", LISTENING_PRACTICE));
      }

      // Reading main
      if (i - lastTest.reading >= gaps.reading && push(takeTest("reading", "Reading"))) {
        lastTest.reading = i;
      } else {
        push(fromRotor("reading", READING_PRACTICE));
      }

      // Writing main (Sundays stay lighter: practice variant only)
      if (dow !== 0 && i - lastTest.writing >= gaps.writing && push(takeTest("writing", "Writing"))) {
        lastTest.writing = i;
      } else {
        push(fromRotor("writing", WRITING_PRACTICE));
      }

      // Speaking — every single day
      push(speakingTask());

      // Extras fill the remaining budget, most useful first
      const otherInput = weakestInput === "reading" ? "listening" : "reading";
      const extras = [
        () => external("vocabulary", `Vocabulary: ${focus.vocabTopic || "topic review"}`),
        () => external("grammar", `Grammar: ${focus.grammarTopic || "review"}`),
        () => {
          // Bonus real test for the weakest skill on long study days
          if (hoursPerDay >= 5 && dow !== 0) {
            const t = takeTest(weakestInput, weakestInput === "reading" ? "Reading" : "Listening");
            if (t) lastTest[weakestInput] = i;
            return t;
          }
          return null;
        },
        () => {
          // Second bonus test on 6-hour plans
          if (hoursPerDay >= 6 && dow !== 0) {
            const t = takeTest(otherInput, otherInput === "reading" ? "Reading" : "Listening");
            if (t) lastTest[otherInput] = i;
            return t;
          }
          return null;
        },
        () => fromRotor(weakestInput, weakestInput === "reading" ? READING_PRACTICE : LISTENING_PRACTICE),
        () => external("review", "Error log: write down today's mistakes and rules", 25),
        () => speakingTask(), // second speaking session on long days
        () => external("vocabulary", "Flashcards: make 20 cards from today's new words", 25),
        () => fromRotor(otherInput, otherInput === "reading" ? READING_PRACTICE : LISTENING_PRACTICE),
        () => external("writing_practice", "Write 10 sentences using today's new vocabulary", 20),
      ];
      for (const make of extras) {
        if (used >= budget - 15 || tasks.length >= MAX_TASKS) break;
        push(make());
      }
    }

    totalTasks += tasks.length;
    days.push({
      date: fmtDate(date),
      weekIndex,
      focus: focus.theme || "",
      tasks,
    });
    mockYesterday = mockToday;
  }

  return { days, totalTasks, weeks };
}
