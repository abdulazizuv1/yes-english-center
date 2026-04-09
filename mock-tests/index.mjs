import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function downloadDocument() {
  const snap = await db.collection("readingTests").doc("test-1").get();

  if (snap.exists) {
    const data = snap.data();
    const outPath = path.join(__dirname, "data", "readingTests", "test-1.json");
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Документ сохранён: ${outPath}`);
  } else {
    console.log("Документ не найден");
  }
}

downloadDocument();
