// Firebase app/auth/firestore bootstrap shared by every module.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();
export {
  app,
  db,
  auth,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  onAuthStateChanged,
};
