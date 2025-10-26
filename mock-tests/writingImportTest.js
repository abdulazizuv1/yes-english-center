const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Путь к JSON файлу
const filePath = path.join(__dirname, "data", "writingTests", "test-1.json");

// Читаем JSON
const rawData = fs.readFileSync(filePath);
const writingTest = JSON.parse(rawData);

// Название документа (test-1)
const docId = "test-1";

// Загрузка в коллекцию "writingTests"
db.collection("writingTests")
  .doc(docId)
  .set(writingTest["test-1"]) // Берем только содержимое test-1
  .then(() => {
    console.log(`✅ Успешно добавлено: ${docId}`);
    console.log(`📝 Task 1: ${writingTest["test-1"].task1.question.substring(0, 50)}...`);
    console.log(`📝 Task 2: ${writingTest["test-1"].task2.question.substring(0, 50)}...`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка добавления:", error);
    process.exit(1);
  });