// One-off fix: fullmockTests/test-13 writing task2 has the instruction line
// duplicated ("You should spend about 40 minutes..." twice). Strips the repeat.
// Usage: node scripts/fix-test13-writing.js
import admin from "firebase-admin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
admin.initializeApp({ credential: admin.credential.cert(require("../serviceAccountKey.json")) });
const db = admin.firestore();

const ref = db.collection("fullmockTests").doc("test-13");
const doc = await ref.get();
if (!doc.exists) {
  console.error("test-13 not found");
  process.exit(1);
}
const d = doc.data();
const w = d.stages.find((s) => s.tasks);
const q = w.tasks[0].task2.question;
console.log("BEFORE:", JSON.stringify(q.slice(0, 120)));

const firstLine = q.split("\n")[0].trim();
const rest = q.slice(firstLine.length).replace(/^\s+/, "");
if (!rest.startsWith(firstLine)) {
  console.log("No duplication found — nothing to fix.");
  process.exit(0);
}
const fixed = firstLine + "\n\n" + rest.slice(firstLine.length).replace(/^\s+/, "");
console.log("AFTER: ", JSON.stringify(fixed.slice(0, 120)));

w.tasks[0].task2.question = fixed;
if (w.task2?.question) w.task2.question = fixed;
await ref.update({ stages: d.stages });
console.log("✅ test-13 writing task2 fixed");
process.exit(0);
