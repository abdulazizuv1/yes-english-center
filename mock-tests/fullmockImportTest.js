const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Инициализация Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Путь к JSON файлу Full Mock Test
const filePath = path.join(__dirname, "data", "full", "test-11.json");

// Читаем JSON
const rawData = fs.readFileSync(filePath);
const fullMockTest = JSON.parse(rawData);

const docId = "test-11";

// Проверяем структуру данных
if (!fullMockTest.stages || fullMockTest.stages.length !== 3) {
  console.error("❌ Неверная структура: должно быть 3 этапа (listening, reading, writing)");
  process.exit(1);
}

// Проверяем каждый этап
const [listening, reading, writing] = fullMockTest.stages;

if (listening.id !== "listening" || !listening.sections || listening.sections.length !== 4) {
  console.error("❌ Неверная структура Listening: должно быть 4 секции");
  process.exit(1);
}

if (reading.id !== "reading" || !reading.passages || reading.passages.length !== 3) {
  console.error("❌ Неверная структура Reading: должно быть 3 прохода");
  process.exit(1);
}

if (writing.id !== "writing" || (!writing.task1 && !writing.tasks)) {
  console.error("❌ Неверная структура Writing: должны быть task1 и task2");
  process.exit(1);
}

console.log("✅ Структура данных проверена");

// Загрузка в коллекцию "fullMockTests"
db.collection("fullmockTests")
  .doc(docId)
  .set(fullMockTest)
  .then(() => {
    console.log(`✅ Успешно добавлен Full Mock Test: ${docId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка добавления Full Mock Test:", error);
    console.error("Детали ошибки:", error.message);
    process.exit(1);
  });