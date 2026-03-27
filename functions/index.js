import functions from "firebase-functions";
import admin from "firebase-admin";
import cors from "cors";
import OpenAI from "openai";
import { Buffer } from "node:buffer";
import process from "node:process";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const corsHandler = cors({ origin: true });

export const createUser = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Only POST requests are allowed");
    }

    const { email, password, role, username, name } = req.body;

    if (!email || !password || !role) {
      return res.status(400).send("Missing data fields.");
    }

    try {
      const bearerToken = req.headers.authorization;

      if (
        typeof bearerToken !== "string" ||
        !bearerToken.startsWith("Bearer ")
      ) {
        return res.status(401).send("Missing or invalid Authorization header.");
      }

      let decodedToken;
      try {
        const idToken = bearerToken.split("Bearer ")[1];
        decodedToken = await auth.verifyIdToken(idToken);
      } catch (err) {
        console.error("Failed to verify ID token", err);
        return res.status(401).send("Invalid ID token.");
      }

      if (!decodedToken?.uid) {
        return res.status(401).send("Invalid token payload.");
      }

      const adminDoc = await db.collection("users").doc(decodedToken.uid).get();
      if (!adminDoc.exists || adminDoc.data().role !== "admin") {
        return res.status(403).send("Permission denied");
      }

      // Check if username is unique (if provided)
      if (username) {
        const usernameQuery = await db.collection("users")
          .where("username", "==", username)
          .get();
        
        if (!usernameQuery.empty) {
          return res.status(400).send("Username already exists. Please choose a different username.");
        }
      }

      const userRecord = await auth.createUser({ email, password });
      
      // Prepare user data
      const userData = {
        email,
        role,
        name: name || "No name",
      };
      
      // Add username if provided
      if (username) {
        userData.username = username;
      }
      
      await db.collection("users").doc(userRecord.uid).set(userData);

      return res.status(200).json({ success: true, uid: userRecord.uid });
    } catch (err) {
      console.error("Error in Cloud Function:", err);
      return res.status(500).send("Internal error: " + err.message);
    }
  });
});

export const deleteUser = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Only POST allowed");
    }

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).send("Missing UID");
    }

    try {
      const bearer = req.headers.authorization;
      if (!bearer?.startsWith("Bearer ")) {
        return res.status(401).send("Missing or invalid token");
      }

      const idToken = bearer.split("Bearer ")[1];
      const decoded = await auth.verifyIdToken(idToken);
      const adminDoc = await db.collection("users").doc(decoded.uid).get();

      if (!adminDoc.exists || adminDoc.data().role !== "admin") {
        return res.status(403).send("Permission denied");
      }

      await auth.deleteUser(uid);
      await db.collection("users").doc(uid).delete();

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error deleting user:", err);
      return res.status(500).send("Internal error: " + err.message);
    }
  });
});

export const evaluateWriting = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST requests are allowed" });
    }

    // Verify auth token
    const bearerToken = req.headers.authorization;
    if (!bearerToken?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    let uid;
    try {
      const idToken = bearerToken.split("Bearer ")[1];
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      return res.status(401).json({ error: "Invalid ID token." });
    }

    // Rate limit: read-only check first — do NOT increment yet
    const today = new Date().toISOString().split("T")[0];
    const usageRef = admin.database().ref(`aiUsage/${uid}/${today}/count`);

    let currentCount;
    try {
      const snapshot = await usageRef.get();
      currentCount = snapshot.exists() ? snapshot.val() : 0;
      if (currentCount >= 3) {
        return res.status(429).json({ error: "limit_reached", used: 3, max: 3 });
      }
    } catch (err) {
      console.error("RTDB read error:", err);
      return res.status(500).json({ error: "rtdb_failed", message: err.message });
    }

    const { task1Text, task2Text, task1ImageUrl } = req.body;

    // Build OpenAI user message content
    const userContent = [];

    // Attach Task 1 image if available
    if (task1ImageUrl) {
      try {
        const imgRes = await fetch(task1ImageUrl);
        const buf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        userContent.push({ type: "text", text: "Task 1 image (the chart/graph the student described):" });
        userContent.push({ type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } });
      } catch (imgErr) {
        console.warn("Could not fetch Task 1 image:", imgErr.message);
      }
    }

    let promptText = "";
    if (task1Text) promptText += `### Task 1 Response:\n${task1Text}\n\n`;
    if (task2Text) promptText += `### Task 2 Response:\n${task2Text}\n\n`;
    promptText += "Evaluate the writing above according to official IELTS band descriptors. For each task present, give:\n- Band scores for Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy\n- Estimated band score for the task\n- Key strengths (bullet list)\n- Areas for improvement (bullet list with specific suggestions)\n- 2-3 corrected example sentences from the student's actual writing\n\nFinish with an Overall Estimated Band Score.";
    userContent.push({ type: "text", text: promptText });

    // Call OpenAI — only increment the counter after a successful response
    let feedbackText;
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You are an expert IELTS examiner. Evaluate the student's writing strictly according to official IELTS Writing band descriptors. Always respond in English.",
          },
          { role: "user", content: userContent },
        ],
      });
      feedbackText = completion.choices[0].message.content;
    } catch (err) {
      console.error("OpenAI error:", err);
      return res.status(500).json({ error: "openai_failed", message: err.message });
    }

    // OpenAI succeeded — now increment the counter
    let newCount;
    try {
      const txResult = await usageRef.transaction((current) => {
        if (current === null) return 1;
        if (current >= 3) return; // abort
        return current + 1;
      });
      newCount = txResult.committed ? txResult.snapshot.val() : 3;
    } catch (err) {
      console.error("RTDB increment error:", err);
      // Counter failed to increment but feedback is ready — still return it
      newCount = currentCount + 1;
    }

    return res.status(200).json({ feedbackText, used: newCount, max: 3 });
  });
});
