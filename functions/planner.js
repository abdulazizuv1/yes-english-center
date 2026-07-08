/**
 * Study plan assembly — deterministic. Claude only supplies skill weights,
 * weekly focus topics and advice; every date, task and test link is built
 * here so the schedule can never be hallucinated.
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

  const hours = Math.min(6, Math.max(0.5, parseFloat(hoursPerDay)));
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
  listening_review: 20,
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

const SPEAKING_PROMPTS = [
  "Speaking Part 1: record yourself — hometown, work, hobbies",
  "Speaking Part 2: 2-minute cue card, record and listen back",
  "Speaking Part 3: discuss opinions out loud for 10 minutes",
  "Speaking: describe a chart or photo aloud for 2 minutes",
  "Speaking: shadow a native speaker for 15 minutes",
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

  const weights = ai?.skillWeights || {};
  const focuses = Array.isArray(ai?.weeklyFocuses) && ai.weeklyFocuses.length > 0
    ? ai.weeklyFocuses
    : DEFAULT_FOCUSES;

  // Tasks per study day from available hours
  const slotsPerDay = hoursPerDay <= 1 ? 2 : hoursPerDay <= 2 ? 3 : 4;

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
  let speakingSeq = 0;
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

  const external = (type, title) => ({
    id: `t${++taskSeq}`,
    kind: "external",
    type,
    title,
    minutes: TASK_MINUTES[type] ?? 20,
    status: "pending",
  });

  const speakingTask = () => external("speaking", SPEAKING_PROMPTS[speakingSeq++ % SPEAKING_PROMPTS.length]);

  // Deficit round-robin over the two "input" skills: the weaker skill gets
  // proportionally more days, but the other one never disappears entirely.
  const scheduledCount = { reading: 0, listening: 0 };
  const pickInputSkill = () => {
    const ratioReading = (scheduledCount.reading + 1) / (weights.reading ?? 1);
    const ratioListening = (scheduledCount.listening + 1) / (weights.listening ?? 1);
    return ratioReading <= ratioListening ? "reading" : "listening";
  };
  const takeInputTest = (skill) => {
    const t = takeTest(skill, skill === "reading" ? "Reading" : "Listening");
    if (t) scheduledCount[skill]++;
    return t;
  };

  const speakingBias = (weights.speaking ?? 1) >= 1.25;
  const writingBias = (weights.writing ?? 1) >= 1.25;

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
    let mockToday = false;

    if (daysLeft === 1) {
      // Day before the exam: rest, no cramming
      tasks.push(external("rest", "Rest day — light vocabulary review, sleep early"));
    } else if (dow === 6) {
      // Saturday: mock day or heavy practice
      const mockWeek = mockEveryWeek || weekIndex % 2 === 1;
      if (mockWeek && daysLeft > 3) {
        const mock = takeTest("fullmock", "Full Mock");
        if (mock) {
          tasks.push(mock);
          mockToday = true;
        } else {
          const r = takeInputTest("reading");
          const l = takeInputTest("listening");
          if (r) tasks.push(r);
          if (l) tasks.push(l);
        }
      } else {
        const t = takeInputTest(pickInputSkill());
        if (t) tasks.push(t);
        tasks.push(external("vocabulary", `Vocabulary: ${focus.vocabTopic || "topic review"}`));
        if (slotsPerDay >= 3) tasks.push(speakingTask());
      }
    } else if (dow === 0) {
      // Sunday: review + light work
      if (mockYesterday) {
        tasks.push(external("mock_review", "Review yesterday's mock: analyse every mistake"));
      } else {
        tasks.push(external("review", "Review this week's mistakes and notes"));
      }
      if (slotsPerDay >= 3) {
        tasks.push(external("vocabulary", `Vocabulary: ${focus.vocabTopic || "topic review"}`));
      }
    } else {
      // Weekdays
      if (dow === 2 || dow === 4 || (writingBias && dow === 5)) {
        // Tue/Thu (+Fri when writing is weak): writing day
        const w = takeTest("writing", "Writing");
        if (w) tasks.push(w);
        if (slotsPerDay >= 3) {
          tasks.push(external("grammar", `Grammar: ${focus.grammarTopic || "review"}`));
        }
        if (speakingBias && dow === 2 && slotsPerDay >= 3) {
          tasks.push(speakingTask());
        }
      } else {
        // Mon/Wed/Fri: input skills, weaker one scheduled more often
        const skill = pickInputSkill();
        const t = takeInputTest(skill);
        if (t) tasks.push(t);
        if (skill === "reading") {
          tasks.push(external("reading_analysis", "Reading analysis: keywords & answer locations"));
        } else {
          tasks.push(external("listening_review", "Listening review: replay and transcribe hard sections"));
        }
        if (dow === 3) {
          // Wednesday: speaking practice for everyone
          tasks.push(speakingTask());
        } else if (slotsPerDay >= 4) {
          const t2 = takeInputTest(pickInputSkill());
          if (t2) tasks.push(t2);
        }
      }
      if (slotsPerDay >= 3 && tasks.length < slotsPerDay) {
        tasks.push(external("vocabulary", `Vocabulary: ${focus.vocabTopic || "topic review"}`));
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
