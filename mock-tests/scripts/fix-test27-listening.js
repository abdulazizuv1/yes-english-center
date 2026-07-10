// One-off repair: listeningTests/test-27 was saved by the buggy add tool with
// question ids starting at q41 (table UI counter leak) and table answers keyed
// by stale UI numbers (q97, q159). Rebuilds the section-1 table as q1-q6 and
// shifts every other question id down by 34 (q41->q7 ... q74->q40).
//
// Usage:  node scripts/fix-test27-listening.js          (dry run — prints plan)
//         node scripts/fix-test27-listening.js --apply  (writes to Firestore)
import admin from "firebase-admin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccountKey.json")) });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const SHIFT = 34;

const ref = db.collection("listeningTests").doc("test-27");
const doc = await ref.get();
if (!doc.exists) { console.error("test-27 not found"); process.exit(1); }
const data = doc.data();
const t = data.parts;

/* ── 1. Rebuild the section-1 table as q1..q6 ── */
const table = t.sections[0].content.find((q) => q.type === "table");
if (!table) { console.error("no table in section 1 — already fixed?"); process.exit(1); }

// Clean the duplicated cell text and normalise placeholders
table.rows[0].otherinformation = "small groups (max 1_____ people)";
table.rows[1].whatyoulearn =
  "basic theory e.g. understanding the 2_____ and tides<br>basic sailing skills including 3_____ information";
table.rows[1].cost = "£200 4_____ available for club members<br>all inclusive (plus a useful 5_____)";
table.rows[1].otherinformation = "a 6_____ at the end of the course for all participants";

table.questions = {
  1: { questionId: "q1", text: "small groups (max 1_____ people)", row: 0, column: 3, columnName: "otherinformation" },
  2: { questionId: "q2", text: "basic theory e.g. understanding the 2_____ and tides", row: 1, column: 1, columnName: "whatyoulearn" },
  3: { questionId: "q3", text: "basic sailing skills including 3_____ information", row: 1, column: 1, columnName: "whatyoulearn" },
  4: { questionId: "q4", text: "£200 4_____ available for club members", row: 1, column: 2, columnName: "cost" },
  5: { questionId: "q5", text: "all inclusive (plus a useful 5_____)", row: 1, column: 2, columnName: "cost" },
  6: { questionId: "q6", text: "a 6_____ at the end of the course for all participants", row: 1, column: 3, columnName: "otherinformation" },
};
// Answers reassembled from the stored (miskeyed) set by matching the sentences
table.answer = { q1: "10", q2: "weather", q3: "safety", q4: "discount", q5: "dictionary", q6: "certificate" };

/* ── 2. Shift all remaining question ids down by 34 ── */
const shiftId = (qid) => {
  const n = parseInt(String(qid).replace(/^q/, ""), 10);
  if (!Number.isFinite(n)) return qid;
  if (n < 41) { console.error(`unexpected id ${qid} (< 41)`); process.exit(1); }
  return `q${n - SHIFT}`;
};

t.sections.forEach((s) => {
  s.content.forEach((item) => {
    if (item.type === "question" && item.questionId) {
      item.questionId = shiftId(item.questionId);
    }
    if (item.type === "question-group" && Array.isArray(item.questions)) {
      item.questions.forEach((sub) => { sub.questionId = shiftId(sub.questionId); });
      const nums = item.questions.map((sub) => parseInt(sub.questionId.slice(1), 10));
      item.questionId = nums.length > 1 ? `q${nums[0]}_${nums[nums.length - 1]}` : `q${nums[0]}`;
    }
  });
});

/* ── 3. Verify: ids must now be exactly q1..q40, each once ── */
const seen = [];
t.sections.forEach((s) => s.content.forEach((item) => {
  if (item.type === "question" && item.questionId) seen.push(item.questionId);
  if (item.type === "question-group") item.questions.forEach((sub) => seen.push(sub.questionId));
  if (item.type === "table") Object.values(item.questions).forEach((q) => seen.push(q.questionId));
}));
const nums = seen.map((x) => parseInt(x.slice(1), 10)).sort((a, b) => a - b);
const ok = nums.length === 40 && nums.every((n, i) => n === i + 1);
console.log(`ids after fix: ${seen.length} questions, continuous 1..40: ${ok}`);
if (!ok) { console.error("Verification FAILED — not writing.", nums.join(",")); process.exit(1); }

t.sections.forEach((s, si) => {
  const ids = s.content.map((q) =>
    q.type === "table" ? "TABLE(q1-q6)" :
    q.questionId || null).filter(Boolean);
  console.log(` s${si + 1}: ${ids.join(" ")}`);
});

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply to save.");
  process.exit(0);
}

await ref.update({ parts: t });
console.log("✅ test-27 fixed in Firestore");
process.exit(0);
