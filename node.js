import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";
import 'dotenv/config';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

for (const [key, value] of Object.entries(firebaseConfig)) {
  if (!value) {
    throw new Error(`Missing environment variable for Firebase config: ${key}`);
  }
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function downloadDocument() {
  const ref = doc(db, "listeningTests", "test-12");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    fs.writeFileSync("test-12.json", JSON.stringify(data, null, 2));
    console.log("Документ сохранён как document.json");
  } else {
    console.log("Документ не найден");
  }
}

downloadDocument()