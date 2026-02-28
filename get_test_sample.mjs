import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

const configContent = fs.readFileSync("./config.js", "utf8");
const configMatch = configContent.match(/export const firebaseConfig = ({[\s\S]*?});/);

if (configMatch) {
  const firebaseConfig = eval("(" + configMatch[1] + ")");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  async function run() {
    for (const col of ["listeningTests", "writingTests", "resultsWriting", "resultsListening"]) {
      const snap = await getDocs(query(collection(db, col), limit(1)));
      console.log(`\nCollection: ${col}`);
      snap.forEach(doc => {
         console.log(doc.id, "=>", Object.keys(doc.data()), "title:", doc.data().title || doc.data().name || doc.data().testTitle, "testId:", doc.data().testId);
      });
    }
    process.exit(0);
  }
  run();
}
