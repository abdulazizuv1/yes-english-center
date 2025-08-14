const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Инициализация Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Путь к JSON файлу
const filePath = path.join(__dirname, "data", "readingTests", "test-9.json");

// Читаем JSON
const rawData = fs.readFileSync(filePath);
const readingTest = JSON.parse(rawData);

// Название документа (test-1)
const docId = "test-9";

// Загрузка в коллекцию "readingTests"
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