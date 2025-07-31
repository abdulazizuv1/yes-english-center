const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 🔐 Инициализация Firebase Admin
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📁 Путь к JSON файлу
const filePath = path.join(__dirname, "data", "listeningTests", "test-5.json");

// 📥 Чтение JSON файла
const rawData = fs.readFileSync(filePath);
const listeningTest = JSON.parse(rawData);

// 🆔 Название документа
const docId = "test-5";

// 🔥 Загрузка в Firestore: коллекция "listeningTests"
// ИСПРАВЛЕНИЕ: Сохраняем данные напрямую без дополнительной обертки
db.collection("listeningTests")
  .doc(docId)
  .set({
    ...listeningTest,  // Распаковываем все поля из JSON (title, parts, etc.)
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