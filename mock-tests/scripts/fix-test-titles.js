/**
 * Align test titles with their document ids.
 *
 * Links go by document id (test-23), but the title is typed by hand, so a
 * few listening tests ended up titled with a different number — a student
 * clicking "Listening test 24" landed on test-23. The dashboard now shows
 * the id-derived name so nobody is misled, but the stored titles are still
 * wrong; this script repairs them.
 *
 * Only titles whose number DISAGREES with the document id are touched.
 * Titles with no number of their own ("MOCK OFFICIAL") are left alone.
 *
 *   node mock-tests/scripts/fix-test-titles.js                  # dry run
 *   node mock-tests/scripts/fix-test-titles.js --apply          # write
 *   node mock-tests/scripts/fix-test-titles.js --apply listening
 */
const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(__dirname, "..", "serviceAccountKey.json"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const COLLECTIONS = {
  listening: { col: "listeningTests", name: (n) => `IELTS Listening Test ${n}` },
  reading: { col: "readingTests", name: (n) => `IELTS Reading Test ${n}` },
  writing: { col: "writingTests", name: (n) => `IELTS Academic Writing Test ${n}` },
  fullmock: { col: "fullmockTests", name: (n) => `IELTS Full Mock Test ${n}` },
};

const apply = process.argv.includes("--apply");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

// last run of digits: "test-23" → 23, "Listening test 24" → 24
const lastNum = (s) => {
  const m = String(s ?? "").match(/(\d+)(?!.*\d)/);
  return m ? parseInt(m[1], 10) : null;
};

(async () => {
  const types = only.length ? only : Object.keys(COLLECTIONS);
  let totalFixed = 0;

  for (const type of types) {
    const cfg = COLLECTIONS[type];
    if (!cfg) {
      console.log(`skipping unknown type "${type}"`);
      continue;
    }

    const snap = await db.collection(cfg.col).get();
    const fixes = [];

    snap.docs.forEach((d) => {
      const data = d.data();
      const title = String(data.title || data.name || "").trim();
      const idNum = lastNum(d.id);
      const titleNum = lastNum(title);
      // no title, no number in the title, or already agreeing → leave it
      if (!title || idNum === null || titleNum === null || titleNum === idNum) return;
      fixes.push({ id: d.id, from: title, to: cfg.name(idNum) });
    });

    console.log(`\n═══ ${type} (${cfg.col}) — ${snap.size} tests, ${fixes.length} to fix ═══`);
    fixes.forEach((f) => console.log(`  ${f.id.padEnd(10)} "${f.from}"  →  "${f.to}"`));

    if (apply && fixes.length) {
      for (const f of fixes) {
        const update = { title: f.to };
        // listening keeps a copy of the title inside parts{}
        const doc = await db.collection(cfg.col).doc(f.id).get();
        if (doc.data()?.parts?.title !== undefined) update["parts.title"] = f.to;
        await db.collection(cfg.col).doc(f.id).update(update);
        console.log(`  ✔ updated ${f.id}`);
      }
    }
    totalFixed += fixes.length;
  }

  console.log(
    apply
      ? `\nDone — ${totalFixed} title(s) updated.`
      : `\nDry run — ${totalFixed} title(s) would change. Re-run with --apply to write.`
  );
  process.exit(0);
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
