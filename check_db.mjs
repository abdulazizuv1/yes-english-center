import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const configContent = fs.readFileSync("./config.js", "utf8");
const configMatch = configContent.match(/export const firebaseConfig = ({[\s\S]*?});/);

if (configMatch) {
  const firebaseConfig = eval("(" + configMatch[1] + ")");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  getDocs(collection(db, "readingTests")).then(snap => {
    let output = "";
    snap.forEach(doc => {
      output += `Doc ID: ${doc.id}\nKeys: ${Object.keys(doc.data())}\nTitle: ${doc.data().title}\ntestId: ${doc.data().testId}\n---\n`;
    });
    console.log(output);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log("Config not found");
  process.exit(1);
}
