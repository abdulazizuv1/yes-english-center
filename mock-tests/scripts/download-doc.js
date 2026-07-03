// Download a Firestore document as JSON (admin SDK, bypasses security rules).
// Usage: node scripts/download-doc.js <collection> <docId>
// Example: node scripts/download-doc.js fullmockTests test-14
import admin from "firebase-admin";
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const [collection, docId] = process.argv.slice(2);
if (!collection || !docId) {
  console.error("Usage: node scripts/download-doc.js <collection> <docId>");
  process.exit(1);
}

const snap = await db.collection(collection).doc(docId).get();
if (!snap.exists) {
  console.error(`Document ${collection}/${docId} not found`);
  process.exit(1);
}

const filename = `${docId}.json`;
fs.writeFileSync(filename, JSON.stringify(snap.data(), null, 2));
console.log(`Saved ${collection}/${docId} to ${filename}`);
