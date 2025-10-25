const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const filePath = path.join(__dirname, "data", "readingTests", "test-15.json");

const rawData = fs.readFileSync(filePath);
const readingTest = JSON.parse(rawData);

const docId = "test-15";

db.collection("readingTests")
  .doc(docId)
  .set(readingTest)
  .then(() => {
    console.log(`✅ Успешно добавлено: ${docId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка добавления:", error);
    process.exit(1);
  });