import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.firebasestorage.app",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function downloadDocument() {
  const ref = doc(db, "readingTests", "test-13");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    fs.writeFileSync("test-13.json", JSON.stringify(data, null, 2));
    console.log("Документ сохранён как document.json");
  } else {
    console.log("Документ не найден");
  }
}

downloadDocument()