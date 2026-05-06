const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function exportAIWritingFeedback() {
  const snapshot = await db.collection("aiWritingFeedback").get();

  if (snapshot.empty) {
    console.log("⚠️  aiWritingFeedback collection is empty.");
    process.exit(0);
  }

  const docs = {};
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Convert Firestore Timestamps to ISO strings so JSON is readable
    if (data.createdAt?.toDate) {
      data.createdAt = data.createdAt.toDate().toISOString();
    }
    docs[doc.id] = data;
  });

  const outDir = path.join(__dirname, "data", "aiWritingFeedback");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "export.json");
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2), "utf-8");

  console.log(`✅ Exported ${snapshot.size} document(s) → ${outPath}`);
  process.exit(0);
}

exportAIWritingFeedback().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
