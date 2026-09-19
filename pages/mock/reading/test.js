import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";
import { initReadingTest } from "./components/init.js";

const app = initializeApp(firebaseConfig);

initReadingTest({
  db: getFirestore(app),
  auth: getAuth(app),
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onAuthStateChanged,
});

// Keeps a copy of this page on the computer so it still opens after a
// refresh with no internet (see /sw.js). Students who never visited the
// home page first get it registered here.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
