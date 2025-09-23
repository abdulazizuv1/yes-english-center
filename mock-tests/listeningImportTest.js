const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const filePath = path.join(__dirname, "data", "listeningTests", "test-7.json");

const rawData = fs.readFileSync(filePath);
const listeningTest = JSON.parse(rawData);

const docId = "test-7";

db.collection("listeningTests")
  .doc(docId)
  .set({
    ...listeningTest,  
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })
  .then(() => {
    console.log(`✅ Listening test ${docId} успешно загружен.`);
    console.log("Структура загруженных данных:", Object.keys(listeningTest));
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка загрузки listening теста:", error);
    process.exit(1);
  });