import admin from "firebase-admin";
import { createRequire } from "module";
import fs from "fs";

const require = createRequire(import.meta.url);

const serviceAccount = require("./mock-tests/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function downloadDocument(collection, docId) {
  const ref = db.collection(collection).doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data();
    const filename = `${docId}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Документ сохранён как ${filename}`);
  } else {
    console.log("Документ не найден");
  }
}

downloadDocument("fullmockTests", "test-14");