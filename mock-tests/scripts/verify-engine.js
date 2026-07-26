/**
 * Verify the question engine against every saved test.
 *
 *   node mock-tests/scripts/verify-engine.js
 *
 * Reads the JSON dumps in mock-tests/data (no Firebase needed) and, for
 * each test, checks that the engine can:
 *   1. normalize every stored question shape (nothing silently dropped)
 *   2. produce a gradeable row with an answer key for each question
 *   3. score 100% for perfect answers and 0% for wrong ones
 *
 * Run it after touching pages/mock/engine/ — it is the fastest proof that
 * the three test pages still read and grade every existing test.
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "..");
const DATA = path.join(ROOT, "mock-tests", "data");

const KNOWN_READING_TYPES = new Set([
  "gap-fill", "text-question", "true-false-notgiven", "yes-no-notgiven",
  "multiple-choice", "paragraph-matching", "match-person", "match-purpose",
  "table", "question-group", "drag_drop", "map-labelling",
]);

let problems = 0;
const fail = (msg) => { problems++; console.log(`  ✗ ${msg}`); };

/* Perfect answers for a set of canonical items */
function perfectAnswers(items, G) {
  const answers = {};
  for (const item of items) {
    if (item.kind === "drag-slots" && item.storage === "grouped") {
      const obj = {};
      item.slots.forEach((s) => { if (s.correctId) obj[s.slotId] = s.correctId; });
      answers[item.groupId] = obj;
      continue;
    }
    for (const r of G.gradeItem(item, {})) {
      if (!r.expected.length) continue;
      const first = G.splitAnswerVariants(r.expected[0])[0] || r.expected[0];
      answers[r.id] = first.includes("/") ? first.split("/")[0].trim() : first;
    }
  }
  return answers;
}

function checkTest(label, items, G) {
  const { rows, total } = G.gradeItems(items, {});
  const unkeyed = rows.filter((r) => !r.expected.length);
  const noId = rows.filter((r) => !r.id);

  const perfect = perfectAnswers(items, G);
  const scored = G.gradeItems(items, perfect);
  const missed = scored.rows.filter((r) => r.expected.length && !r.correct);

  const wrong = {};
  Object.keys(perfect).forEach((k) => {
    wrong[k] = typeof perfect[k] === "object" ? {} : "zz_definitely_wrong_zz";
  });
  const wrongScore = G.gradeItems(items, wrong).correct;

  const kinds = {};
  items.forEach((i) => (kinds[i.kind] = (kinds[i.kind] || 0) + 1));

  let ok = true;
  if (missed.length) { fail(`${label}: ${missed.length} question(s) not correct with perfect answers (${missed.slice(0,3).map(r=>r.id).join(", ")})`); ok = false; }
  if (wrongScore > 0) { fail(`${label}: ${wrongScore} question(s) scored with wrong answers`); ok = false; }
  if (noId.length) { fail(`${label}: ${noId.length} question(s) without an id`); ok = false; }
  if (unkeyed.length) { fail(`${label}: ${unkeyed.length} question(s) with no answer key (${unkeyed.slice(0,3).map(r=>r.id).join(", ")})`); ok = false; }

  if (ok) {
    console.log(`  ✓ ${label}: ${total} questions {${Object.entries(kinds).map(([k,v])=>`${k}:${v}`).join(", ")}}`);
  }
}

/* Reading tests carry no stored ids — the pages number them by order,
   counting straight through all passages (q1..q40), so the counter has to
   carry over between passages. */
function numberReading(questions, prefix, start) {
  let c = start;
  questions.forEach((q) => {
    if (q.question && q.type !== "drag_drop") q.qId = `${prefix}${c++}`;
    if (q.type === "question-group" && q.questions) q.questions.forEach((s) => { s.qId = `${prefix}${c++}`; });
    if (q.type === "drag_drop" && q.slots) q.slots.forEach((s) => { if (q.inlineText || s.qId) s.qId = `${prefix}${c++}`; });
    if (q.type === "map-labelling" && q.questions) q.questions.forEach((s) => { s.qId = `${prefix}${c++}`; });
    if (q.type === "table" && q.rows) {
      const keys = (q.columns || []).slice(1).map((x) => x.toLowerCase());
      q.rows.forEach((row) => keys.forEach((k) => {
        if (typeof row[k] === "string") row[k] = row[k].replace(/___q\d+___/g, () => `___${prefix}${c++}___`);
      }));
    }
  });
  return c;
}

/* Number a whole reading test, passage by passage, q1..qN */
function numberReadingTest(passages, prefix) {
  let c = 1;
  (passages || []).forEach((p) => { c = numberReading(p.questions || [], prefix, c); });
}

const jsonFiles = (dir) =>
  fs.readdirSync(path.join(DATA, dir))
    .filter((f) => f.endsWith(".json"))
    .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));

(async () => {
  const N = await import(`file://${path.join(ROOT, "pages/mock/engine/normalize.js")}`);
  const G = await import(`file://${path.join(ROOT, "pages/mock/engine/grade.js")}`);
  const R = await import(`file://${path.join(ROOT, "pages/mock/engine/review.js")}`);

  console.log("\n═══ standalone listening ═══");
  for (const f of jsonFiles("listeningTests")) {
    const t = JSON.parse(fs.readFileSync(path.join(DATA, "listeningTests", f)));
    const sections = t.sections || t.parts?.sections || t.parts || [];
    N.repairListeningIds(sections);
    const unknown = sections.flatMap((s) => (s.content || []).filter((i) => !N.normalizeListeningItem(i)).map((i) => i.type));
    if (unknown.length) { fail(`${f}: engine does not understand ${[...new Set(unknown)].join(", ")}`); continue; }
    checkTest(f, sections.flatMap((s) => N.normalizeListeningSection(s)), G);
  }

  console.log("\n═══ standalone reading ═══");
  for (const f of jsonFiles("readingTests")) {
    const t = JSON.parse(fs.readFileSync(path.join(DATA, "readingTests", f)));
    numberReadingTest(t.passages, "q");
    const unknown = (t.passages || []).flatMap((p) => (p.questions || []).filter((q) => !KNOWN_READING_TYPES.has(q.type)).map((q) => q.type));
    if (unknown.length) { fail(`${f}: engine does not understand ${[...new Set(unknown)].join(", ")}`); continue; }
    checkTest(f, (t.passages || []).flatMap((p) => N.normalizeReadingQuestions(p.questions)), G);
  }

  console.log("\n═══ full mock ═══");
  for (const f of jsonFiles("full")) {
    const t = JSON.parse(fs.readFileSync(path.join(DATA, "full", f)));
    const L = (t.stages || []).find((s) => s.id === "listening");
    const R = (t.stages || []).find((s) => s.id === "reading");
    if (L) {
      N.repairListeningIds(L.sections);
      const unknown = (L.sections || []).flatMap((s) => (s.content || []).filter((i) => !N.normalizeListeningItem(i)).map((i) => i.type));
      if (unknown.length) fail(`${f} listening: engine does not understand ${[...new Set(unknown)].join(", ")}`);
      else checkTest(`${f} listening`, (L.sections || []).flatMap((s) => N.normalizeListeningSection(s)), G);
    }
    if (R) {
      numberReadingTest(R.passages, "reading_q");
      const unknown = (R.passages || []).flatMap((p) => (p.questions || []).filter((q) => !KNOWN_READING_TYPES.has(q.type)).map((q) => q.type));
      if (unknown.length) fail(`${f} reading: engine does not understand ${[...new Set(unknown)].join(", ")}`);
      else checkTest(`${f} reading`, (R.passages || []).flatMap((p) => N.normalizeReadingQuestions(p.questions)), G);
    }
  }


  /* review layer — what the result pages show */
  console.log("\n═══ result review ═══");
  {
    // rich rows: option letters get their text, every kind produces rows
    const items = [
      N.normalizeListeningItem({ type: "question", format: "multiple-choice", questionId: "q1",
        text: "Why yearly?", options: { A: "save money", B: "free gift" }, correctAnswer: "B" }),
      N.normalizeListeningItem({ type: "question", format: "gap-fill", questionId: "q2",
        text: "Date: 1____", correctAnswer: "1990, 1991" }),
      N.normalizeListeningItem({ type: "drag_drop", questionId: "q3",
        items: [{ id: "A", text: "trunks" }, { id: "B", text: "leaves" }],
        slots: [{ qId: "q3", label: "stores water", correctId: "A" }] }),
      N.normalizeListeningItem({ type: "map-labelling", questionId: "q4",
        options: { A: "North gate" }, questions: [{ questionId: "q4", text: "Main entrance", correctAnswer: "A" }] }),
    ].filter(Boolean);

    const rows = R.reviewRows(items, { q1: "B", q2: "holidays", q3: "A", q4: "A" });
    const check = (label, got, want) => {
      if (got === want) console.log(`  ✓ ${label}`);
      else fail(`${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    };
    check("every question kind produces a row", rows.length, 4);
    check("option letters show their text", rows.find(r => r.id === "q1").userDisplay, "B. free gift");
    check("drag answers appear in the review", rows.find(r => r.id === "q3").correct, true);
    check("map labelling appears in the review", rows.find(r => r.id === "q4").correct, true);
    check("wrong gap marked incorrect", rows.find(r => r.id === "q2").status, "incorrect");
    check("expected shows both variants", rows.find(r => r.id === "q2").expectedDisplay, "1990 / 1991");

    // stored-only rows (test deleted): same verdicts, no test document
    const stored = R.reviewFromStored(
      { q1: "holidays", q2: "", q3: "wrong" },
      { q1: ["holiday, holidays"], q2: ["beach"], q3: ["right"] }
    );
    check("stored fallback: comma variant accepted", stored.find(r => r.id === "q1").status, "correct");
    check("stored fallback: blank is unanswered", stored.find(r => r.id === "q2").status, "unanswered");
    check("stored fallback: wrong is incorrect", stored.find(r => r.id === "q3").status, "incorrect");

    const summary = R.reviewSummary(stored);
    check("summary counts", `${summary.correct}/${summary.incorrect}/${summary.unanswered}`, "1/1/1");
    check("notice when a recheck differs", R.scoreNotice(3, stored).includes("marked 3"), true);
    check("no notice when scores agree", R.scoreNotice(1, stored), "");
  }

  /* answer-key variants: "holiday, holidays" and "US/American" */
  console.log("\n═══ answer variants ═══");
  const cases = [
    ["holidays vs 'holiday, holidays'", G.textAnswerCorrect("holidays", ["holiday, holidays"]), true],
    ["holiday vs 'holiday, holidays'", G.textAnswerCorrect("holiday", ["holiday, holidays"]), true],
    ["vacation rejected", G.textAnswerCorrect("vacation", ["holiday, holidays"]), false],
    ["'6,000' is one answer", G.textAnswerCorrect("6", ["6,000"]), false],
    ["'6,000' exact", G.textAnswerCorrect("6,000", ["6,000"]), true],
    ["slash variants", G.textAnswerCorrect("american", ["US/American"]), true],
    ["case-insensitive", G.textAnswerCorrect("HOLIDAYS", ["holiday, holidays"]), true],
    ["blank is wrong", G.textAnswerCorrect("", ["holiday"]), false],
  ];
  cases.forEach(([label, got, want]) => {
    if (got === want) console.log(`  ✓ ${label}`);
    else fail(`${label}: got ${got}, want ${want}`);
  });

  console.log(
    problems === 0
      ? "\n✅ engine reads and grades every saved test\n"
      : `\n❌ ${problems} problem(s)\n`
  );
  process.exit(problems ? 1 : 0);
})().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
