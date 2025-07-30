import functions from "firebase-functions";
import admin from "firebase-admin";
import cors from "cors";

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const corsHandler = cors({ origin: true });

export const createUser = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Only POST requests are allowed");
    }

    const { email, password, role } = req.body;

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

      const userRecord = await auth.createUser({ email, password });
      await db.collection("users").doc(userRecord.uid).set({
        email,
        role,
        name: "No name",
      });

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
