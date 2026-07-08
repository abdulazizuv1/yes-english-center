import functions from "firebase-functions";
import admin from "firebase-admin";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { Buffer } from "node:buffer";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { validatePlanInput, fallbackWeights, buildPlan, bandFromScore } from "./planner.js";

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
      return res.status(500).send("Internal error");
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
      return res.status(500).send("Internal error");
    }
  });
});

const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a strict IELTS Writing examiner. Grade honestly using official band descriptors. Never inflate scores.

=== ANNOTATION MARKERS ===
1. Errors: [[ERR:wrong||correct]] — grammar, spelling, wrong word, wrong structure
2. Comments: [[CMT:text]] — structural issues, missing elements, critical observations

=== BAND DESCRIPTORS — USE THESE TO SCORE ===

TASK 1 — TA (Task Achievement):
9: All requirements fully satisfied
8: All requirements covered, key features skilfully selected and highlighted
7: Requirements covered, clear overview, main trends identified, minor omissions
6: Key features covered, overview attempted, some irrelevant/missing details
5: Key features NOT adequately covered, mechanical recounting, may lack data support
4: Few key features selected, may be irrelevant/repetitive/inaccurate
3: Does not address task, largely irrelevant content
2: Barely relates to task

TASK 1 — CC (Coherence & Cohesion):
9: Effortless to follow, cohesion invisible, skilful paragraphing
8: Easy to follow, logically sequenced, well managed cohesion
7: Logically organised, clear progression, cohesive devices flexible but some inaccuracies
6: Generally coherent, cohesive devices used but may be faulty/mechanical/overused
5: Organisation evident but not wholly logical, sentences not fluently linked
4: Not arranged coherently, no clear progression, cohesive devices basic/inaccurate
3: No logical organisation, minimal cohesive devices

TASK 1 — LR (Lexical Resource):
9: Wide range, very natural sophisticated control, rare spelling errors
8: Wide range fluently used, skilful uncommon/idiomatic items, minimal errors
7: Sufficient flexibility, some less common items, awareness of collocation, few errors
6: Generally adequate, restricted range or lack of precision, some spelling errors
5: Limited range, frequent lapses in word choice, repetition, noticeable spelling errors
4: Basic vocabulary, repetitive, word choice errors may impede meaning
3: Very limited, errors severely impede meaning

TASK 1 — GRA (Grammatical Range & Accuracy):
9: Wide range full flexibility, rare errors
8: Wide range flexibly/accurately used, majority error-free
7: Variety of complex structures, generally well controlled, few errors
6: Mix of simple/complex but limited flexibility, errors occur but rarely impede
5: Limited range, complex sentences faulty, grammatical errors frequent
4: Very limited structures, simple sentences predominate, frequent errors impede meaning
3: Errors predominate, meaning prevented from coming through

TASK 2 — TR (Task Response):
9: Fully addressed in depth, clear fully developed position, ideas well supported
8: Appropriately addressed, clear well-developed position, ideas relevant and extended
7: Main parts addressed, clear position, may over-generalise or lack precision
6: Main parts addressed, position relevant but conclusions may be unclear/repetitive, some ideas underdeveloped
5: Incompletely addressed, position not always clear, ideas limited and underdeveloped
4: Minimal/tangential response, position hard to find, ideas lack relevance/support
3: No part adequately addressed, no relevant position, few irrelevant ideas
2: Barely related to prompt, no position

TASK 2 — CC, LR, GRA: same descriptors as Task 1 above

=== ROUNDING RULE — STRICTLY FOLLOW THIS ===

Calculate average of 4 criteria, then round DOWN to nearest 0.5. Never round up.

Examples:
TR6 + CC6 + LR7 + GRA6 = 25 ÷ 4 = 6.25 → 6.0
TR6 + CC7 + LR7 + GRA6 = 26 ÷ 4 = 6.5  → 6.5
TR7 + CC6 + LR7 + GRA6 = 26 ÷ 4 = 6.5  → 6.5
TR6 + CC7 + LR7 + GRA7 = 27 ÷ 4 = 6.75 → 6.5
TR7 + CC7 + LR7 + GRA7 = 28 ÷ 4 = 7.0  → 7.0
TR7 + CC7 + LR8 + GRA7 = 29 ÷ 4 = 7.25 → 7.0

Rule: 
x.0  → x.0
x.25 → x.0  (round down)
x.5  → x.5
x.75 → x.5  (round down)

This is the official IELTS rounding rule. Never inflate scores.

=== OVERALL WRITING SCORE FORMULA ===

Overall = (Task1 score + (Task2 score × 2)) ÷ 3

Then round to nearest 0.5 — both up and down (standard rounding, NOT always down).

Examples:
Task1: 6.0, Task2: 6.5 → (6.0 + 13.0) ÷ 3 = 6.33 → 6.5
Task1: 6.0, Task2: 6.0 → (6.0 + 12.0) ÷ 3 = 6.0  → 6.0
Task1: 5.0, Task2: 6.5 → (5.0 + 13.0) ÷ 3 = 6.0  → 6.0
Task1: 7.0, Task2: 6.5 → (7.0 + 13.0) ÷ 3 = 6.67 → 6.5
Task1: 6.5, Task2: 7.0 → (6.5 + 14.0) ÷ 3 = 6.83 → 7.0

Task 2 weighs DOUBLE because it is longer and worth more in IELTS.

=== WHAT TO ALWAYS CHECK ===

TASK 1:
- Overview: general trend only, NO specific numbers → [[CMT:Overview must show trends only, not specific data]]
- Missing overview entirely → TA drops to 5 max
- All categories/features covered? If not → flag
- Units missing after numbers → [[CMT:Always include units]]
- Tense consistency throughout

TASK 2:
- Clear thesis in intro → if missing: [[CMT:Thesis missing — state your position clearly]]
- While structure for discussion essays → if missing: [[CMT:Where is while structure?]]
- Topic sentence each paragraph → if weak: [[CMT:Poor topic sentence — state your main point clearly]]
- Personal opinion in conclusion → if missing: [[CMT:Where is your opinion?]]
- Personal stories as evidence → [[CMT:Too personal — use general examples]]
- Overused strong modals → [[CMT:Cannot — too strong. Use: may not / might not]]
- Unfinished ideas → [[CMT:Not developed — complete this argument]]
- Max 2 ideas per body paragraph, each fully developed

=== REAL EXAMPLES ===

EXAMPLE 1 — Task 1 Band 6.0 (TA6 CC6 LR6 GRA6):
The [[ERR:given||]] chart provides data about [[ERR:collected waste of recycling centre||waste collected at a recycling centre]] between 2011 and 2015.
Overall, paper was dominant. [[CMT:But what about the general trend — rising or falling overall?]]
[[CMT:In what year?]] Paper [[ERR:incresed||increased]] to 50 [[ERR:tones||tonnes]].
Reason: overview present but no general trend, some categories described mechanically, limited vocabulary range → Band 6

EXAMPLE 2 — Task 2 Band 5.0 (TR4 CC5 LR7 GRA6):
[[CMT:Thesis missing]] Some people think criminals should go to prison...
I [[ERR:belive||believe]] there are [[ERR:altenatives||alternatives]] [[ERR:for||to]] prison... [[CMT:Not developed — complete this argument]]
Reason: position unclear, ideas not developed, paragraph incomplete → TR4

EXAMPLE 3 — Task 2 Band 4.5 (TR4 CC6 LR6 GRA5):
Student used personal car accident as evidence → [[CMT:Too personal — not academic evidence]]
[[CMT:Where is while structure?]]
[[ERR:cannot||may not]] used 4 times → [[CMT:Cannot overused — vary with: may not, might not, is unlikely to]]
Reason: personal anecdote, no while structure, weak position → TR4

EXAMPLE 4 — Task 1 Band 7.0 (TA7 CC8 LR7 GRA6):
Clear overview with general trend stated. All 4 categories described with accurate data. Good cohesive devices. Varied vocabulary. Minor grammar errors only. No missing features.

EXAMPLE 5 — Task 2 Band 6.5 (TR6 CC7 LR7 GRA6):
Both sides acknowledged. Clear thesis. Good linking. Minor: opinion missing in conclusion → [[CMT:Where is your opinion?]]
Reason: position relevant, ideas mostly developed but conclusion weak → TR6

=== OUTPUT — RETURN ONLY THIS JSON ===

{
  "task1": {
    "annotated_text": "Full Task 1 student text with [[ERR:||]] and [[CMT:]] at exact error positions",
    "TA": 6, "CC": 6, "LR": 6, "GRA": 6,
    "score": 6.0,
    "good_sides": ["point 1", "point 2", "point 3"],
    "key_issues": ["issue 1", "issue 2", "issue 3"],
    "grammar_issues": [
      {"wrong": "exact wrong phrase", "correct": "corrected version", "rule": "grammar rule explanation"}
    ],
    "advice": "Specific actionable advice. If vocabulary repeated → give 5 alternative words. If grammar pattern wrong → explain the rule and give example. Must be concrete, not generic."
  },
  "task2": {
    "annotated_text": "Full Task 2 student text with [[ERR:||]] and [[CMT:]] at exact error positions",
    "TR": 6, "CC": 6, "LR": 6, "GRA": 6,
    "score": 6.0,
    "good_sides": ["point 1", "point 2", "point 3"],
    "key_issues": ["issue 1", "issue 2", "issue 3"],
    "grammar_issues": [
      {"wrong": "exact wrong phrase", "correct": "corrected version", "rule": "grammar rule explanation"}
    ],
    "advice": "Specific actionable advice with vocabulary alternatives and grammar patterns to study."
  },
  "overall": 6.0,
  "summary": "3-4 sentences. Honest assessment of current level, biggest weakness, and most important thing to improve."
}`;

const READING_SYSTEM_PROMPT = `You are an expert IELTS Reading examiner and teacher with 15+ years of experience.
You are checking a student's Reading Analysis worksheet.

The worksheet is provided as a table. Column names may vary — they could be in any language or format (English, Russian, Uzbek, abbreviations, etc.). Your first task is to identify which columns contain:
1. Keywords the student extracted from the QUESTION (e.g. "Keywords from Question", "KW Q", "Savol kalit so'zlari", "Ключевые слова вопроса", or similar)
2. Keywords the student found in the PASSAGE/TEXT (e.g. "Keywords from Text", "KW T", "Matn kalit so'zlari", "Ключевые слова текста", or similar)
3. The student's ANSWER (e.g. "Answer", "Ans", "Javob", "Ответ", TRUE/FALSE/NOT GIVEN, a letter, or a word/phrase)

If there is a row/question number column, use it. Otherwise number questions 1, 2, 3...

A Reading Analysis has 3 data points per question:
Keywords from Question: words the student identified as key in the IELTS question
Keywords from Text: words the student found in the passage that match/answer the question
Answer: the student's answer (TRUE/FALSE/NOT GIVEN, a letter, or a specific word/phrase)

KEYWORD QUALITY CRITERIA (use Band 9 keyword knowledge):
STRONG: specific, precise, uses good synonyms, directly leads to the answer
ACCEPTABLE: relevant but could be more precise or use better synonyms
WEAK: too vague, wrong word, missed the key concept, or no synonym awareness

Return ONLY valid JSON in this exact structure, no other text:
{
  "overallScore": <number of fully correct questions>,
  "totalQuestions": <number of data rows evaluated>,
  "percentage": <0-100>,
  "estimatedBand": "<e.g. 6.5 or 7.0>",
  "summary": "<2-3 sentence overall assessment>",
  "questions": [
    {
      "questionNumber": <number>,
      "keywordsFromQuestion": {
        "studentInput": "<what the student wrote>",
        "quality": "strong|acceptable|weak",
        "feedback": "<specific feedback>",
        "suggestions": ["<better keyword option>"]
      },
      "keywordsFromText": {
        "studentInput": "<what the student wrote>",
        "quality": "strong|acceptable|weak",
        "feedback": "<specific feedback>",
        "suggestions": ["<better keyword option>"]
      },
      "answer": {
        "studentInput": "<what the student wrote>",
        "isCorrect": <boolean or null if cannot verify>,
        "correctAnswer": "<if known, else null>",
        "feedback": "<feedback on answer>"
      },
      "overallQuestionScore": <0-3>,
      "questionFeedback": "<one sentence overall for this question>"
    }
  ]
}`;

function getWeekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export const generateAIFeedback = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
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

    const { submissionId } = req.body;
    if (!submissionId) {
      return res.status(400).json({ error: "Missing submissionId" });
    }

    // Check if feedback already exists BEFORE consuming a rate-limit slot
    try {
      const existing = await db.collection("aiWritingFeedback")
        .where("userId", "==", uid)
        .where("submissionId", "==", submissionId)
        .limit(1)
        .get();
      if (!existing.empty) {
        return res.status(200).json({ alreadyExists: true, submissionId });
      }
    } catch (err) {
      console.error("Firestore check error:", err);
      return res.status(500).json({ error: "firestore_failed" });
    }

    // Weekly rate limit — atomic check-and-increment to prevent race condition
    const weekKey = getWeekKey(new Date());
    const usageRef = admin.database().ref(`aiUsage/${uid}/${weekKey}/count`);

    let limitReached = false;
    try {
      await usageRef.transaction((current) => {
        const count = current || 0;
        if (count >= 2) {
          limitReached = true;
          return; // undefined = abort transaction, no write
        }
        return count + 1;
      });
    } catch (err) {
      console.error("RTDB transaction error:", err);
      return res.status(500).json({ error: "rate_limit_check_failed" });
    }

    if (limitReached) {
      return res.status(429).json({ error: "limit_reached", used: 2, max: 2 });
    }

    // Fetch the writing submission from Firestore
    let submission;
    try {
      const docSnap = await db.collection("resultsWriting").doc(submissionId).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Submission not found" });
      }
      submission = docSnap.data();
      if (submission.userId !== uid) {
        return res.status(403).json({ error: "Not your submission" });
      }
    } catch (err) {
      console.error("Firestore fetch error:", err);
      return res.status(500).json({ error: "firestore_failed" });
    }

    const { task1Content, task2Content, task1Question, task2Question, task1ImageUrl } = submission;

    // Build Claude message content
    const userContent = [];

    // Attach Task 1 image if available
    if (task1ImageUrl) {
      try {
        const imgRes = await fetch(task1ImageUrl);
        const buf = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        userContent.push({ type: "text", text: "Task 1 image (the chart/graph the student described):" });
        userContent.push({ type: "image", source: { type: "base64", media_type: mime, data: base64 } });
      } catch (imgErr) {
        console.warn("Could not fetch Task 1 image:", imgErr.message);
      }
    }

    let promptText = "";
    if (task1Question) promptText += `### Task 1 Question:\n${task1Question}\n\n`;
    if (task1Content) promptText += `### Task 1 Student Response:\n${task1Content}\n\n`;
    if (task2Question) promptText += `### Task 2 Question:\n${task2Question}\n\n`;
    if (task2Content) promptText += `### Task 2 Student Response:\n${task2Content}\n\n`;
    promptText += "Evaluate the writing above and return ONLY the JSON object, no extra text.";
    userContent.push({ type: "text", text: promptText });

    // Call Claude API
    let feedbackJson;
    try {
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      });
      const rawText = message.content[0].text;
      // Strip markdown code fences if present
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      feedbackJson = JSON.parse(cleaned);
    } catch (err) {
      console.error("Claude API or parse error:", err);
      await usageRef.transaction((c) => Math.max(0, (c || 1) - 1)).catch(() => {});
      if (err instanceof SyntaxError) {
        return res.status(500).json({ error: "parse_failed", message: "Claude returned invalid JSON" });
      }
      return res.status(500).json({ error: "claude_failed" });
    }

    // Save to Firestore
    try {
      await db.collection("aiWritingFeedback").add({
        userId: uid,
        submissionId,
        feedback: feedbackJson,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("Firestore save error:", err);
      await usageRef.transaction((c) => Math.max(0, (c || 1) - 1)).catch(() => {});
      return res.status(500).json({ error: "firestore_save_failed" });
    }

    return res.status(200).json({ success: true, submissionId });
  });
});

// Telegram notifications are sent server-side so the bot token never
// reaches the browser. Token/chat id come from functions/.env.
async function sendTelegramMessage(text, { chatId, parseMode = "Markdown" } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChat = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !targetChat) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured");
    return false;
  }

  const send = (payload) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: targetChat, ...payload }),
    });

  const res = await send({ text, parse_mode: parseMode, disable_web_page_preview: true });
  if (res.ok) return true;

  const err = await res.json().catch(() => ({}));
  console.error("Telegram API error:", err);

  // Fallback: plain text if formatting failed
  if (err.error_code === 400) {
    const plain = text
      .replace(/<[^>]+>/g, "")
      .replace(/\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    const fallback = await send({ text: plain });
    return fallback.ok;
  }
  return false;
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
  return String(text ?? "").replace(/[&<>"']/g, (char) => map[char]);
}

// Telegram messages cap at 4096 chars — clip long essay text
function clip(value, max) {
  const s = String(value ?? "");
  return s.length > max ? s.substring(0, max) + "..." : s;
}

export const sendTestNotification = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST requests are allowed" });
    }

    const bearerToken = req.headers.authorization;
    if (!bearerToken?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    let decoded;
    try {
      decoded = await auth.verifyIdToken(bearerToken.split("Bearer ")[1]);
    } catch {
      return res.status(401).json({ error: "Invalid ID token." });
    }

    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).json({ error: "Missing type or data" });
    }

    // Identity comes from the verified token, not the request body
    const student = decoded.email || decoded.uid;

    let message;
    if (type === "writing") {
      message = `🎓 *IELTS Writing Test Submission*

👤 *Student:* ${student}
📝 *Test:* ${clip(data.testTitle, 100)}
🆔 *Test ID:* ${clip(data.testId, 50)}
⏰ *Submitted:* ${new Date().toLocaleString()}

📋 *TASK 1 (${data.task1WordCount || 0} words)*
❓ *Question:* ${clip(data.task1Question, 300)}
${data.task1ImageUrl ? `🖼️ [View Image](${data.task1ImageUrl})` : ""}

📝 *Answer:* ${clip(data.task1Content, 1200)}

📋 *TASK 2 (${data.task2WordCount || 0} words)*
❓ *Question:* ${clip(data.task2Question, 300)}

📝 *Answer:* ${clip(data.task2Content, 1200)}

📊 *Total Words:* ${data.totalWordCount || 0}
🏫 *Platform:* YES English Center`;
    } else if (type === "fullmock") {
      const pct = (score, total) => (total ? Math.round((score / total) * 100) : 0);
      message = `🎓 *IELTS FULL MOCK TEST SUBMISSION*

👤 *Student:* ${student}
📝 *Test:* ${clip(data.testTitle, 100)}
🆔 *Test ID:* ${clip(data.testId, 50)}
⏰ *Submitted:* ${new Date().toLocaleString()}

📊 *TEST SCORES:*
👂 *Listening:* ${data.listeningScore}/${data.listeningTotal} (${pct(data.listeningScore, data.listeningTotal)}%)
📖 *Reading:* ${data.readingScore}/${data.readingTotal} (${pct(data.readingScore, data.readingTotal)}%)
🏆 *Overall:* ${data.overallScore}/${data.overallTotal} (${pct(data.overallScore, data.overallTotal)}%)

📝 *WRITING SECTION:*

📋 *TASK 1 (${data.task1WordCount || 0} words)*
${clip(data.task1, 1000)}

📋 *TASK 2 (${data.task2WordCount || 0} words)*
${clip(data.task2, 1000)}

🏫 *Platform:* YES English Center - Full Mock Test`;
    } else if (type === "feedback") {
      message = `📩 *New Feedback Received*

👤 *User:* ${clip(data.name, 100)}
📧 *Email:* ${student}

📌 *Category:* ${clip(data.category, 100)}
⚠️ *Priority:* ${clip(data.priority, 50)}
📝 *Subject:* ${clip(data.subject, 200)}

💬 *Message:*
${clip(data.message, 2000)}`;
    } else {
      return res.status(400).json({ error: "Unknown notification type" });
    }

    const chatId = type === "feedback" ? process.env.TELEGRAM_FEEDBACK_CHAT_ID : undefined;
    const ok = await sendTelegramMessage(message, { chatId });
    return res.status(ok ? 200 : 502).json({ success: ok });
  });
});

// Public endpoint for the landing-page contact form (visitors are not
// signed in). Validates input server-side and keeps the bot token here.
export const submitContactForm = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST requests are allowed" });
    }

    const { name, phone, group, comment } = req.body || {};
    if (!name || !phone || !group) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const groupNames = {
      general_english: "General English",
      ielts: "IELTS",
      sat: "SAT",
    };

    const dateStr = new Date().toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });

    let message = `📩 <b>Новая заявка с сайта YES</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `👤 <b>ФИО:</b> ${escapeHtml(clip(name, 100))}\n`;
    message += `📞 <b>Телефон:</b> ${escapeHtml(clip(phone, 30))}\n`;
    message += `📚 <b>Группа:</b> ${groupNames[group] || escapeHtml(clip(group, 50))}\n`;
    if (comment && String(comment).trim()) {
      message += `💬 <b>Комментарий:</b> ${escapeHtml(clip(comment, 500))}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `🕐 <i>${dateStr}</i>`;

    const ok = await sendTelegramMessage(message, { parseMode: "HTML" });
    return res.status(ok ? 200 : 502).json({ success: ok });
  });
});

export const analyzeReadingAnalysis = functions.https.onRequest({ timeoutSeconds: 540 }, (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST requests are allowed" });
    }

    const bearerToken = req.headers.authorization;
    if (!bearerToken?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    let uid, userEmail;
    try {
      const idToken = bearerToken.split("Bearer ")[1];
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
      userEmail = decoded.email || null;
    } catch {
      return res.status(401).json({ error: "Invalid ID token." });
    }

    // questionsData is passed directly in the request body — no pre-existing Firestore doc needed
    const { mode, testId, testTitle, fileName, questionsData } = req.body;
    if (!questionsData) {
      return res.status(400).json({ error: "Missing questionsData" });
    }

    // Weekly rate limit — 5/week
    const weekKey = getWeekKey(new Date());
    const usageRef = admin.database().ref(`aiReadingUsage/${uid}/${weekKey}/count`);

    let limitReached = false;
    try {
      await usageRef.transaction((current) => {
        const count = current || 0;
        if (count >= 5) { limitReached = true; return; }
        return count + 1;
      });
    } catch (err) {
      console.error("RTDB transaction error:", err);
      return res.status(500).json({ error: "rate_limit_check_failed" });
    }

    if (limitReached) {
      return res.status(429).json({ error: "limit_reached", used: 5, max: 5 });
    }

    // Fetch passage if with_passage mode
    let passageText = null;
    if (mode === "with_passage" && testId) {
      try {
        const testSnap = await db.collection("readingTests").doc(testId).get();
        if (testSnap.exists) {
          const testData = testSnap.data();
          if (testData.passages && Array.isArray(testData.passages)) {
            passageText = testData.passages
              .map(p => p.text || p.passageText || p.content || "")
              .filter(Boolean)
              .join("\n\n---\n\n");
          } else {
            passageText = testData.passageText || testData.text || testData.content || null;
          }
        }
      } catch (err) {
        console.warn("Could not fetch reading test passage:", err.message);
      }
    }

    // Build table string from questionsData
    let tableStr;
    if (questionsData.headers && Array.isArray(questionsData.rows)) {
      const headers = questionsData.headers;
      tableStr = "COLUMN HEADERS: " + headers.join(" | ") + "\n\n";
      tableStr += questionsData.rows
        .map((row, i) => `Row ${i + 1}: ${headers.map(h => row[h] ?? "").join(" | ")}`)
        .join("\n");
    } else if (Array.isArray(questionsData)) {
      tableStr = JSON.stringify(questionsData, null, 2);
    } else {
      tableStr = JSON.stringify(questionsData, null, 2);
    }

    const modeInstruction = passageText
      ? `You have the passage text below. Verify if keywords from text actually appear in the passage and if the answer is correct.\n\nPASSAGE TEXT:\n${passageText}\n\n`
      : `You do NOT have the passage text. Evaluate keyword quality and logical consistency. Set answer.isCorrect to null for all questions.\n\n`;

    const userPrompt = `${modeInstruction}STUDENT READING ANALYSIS TABLE:\n${tableStr}\n\nIdentify the columns, evaluate each data row as a question, and return ONLY the JSON object, no extra text.`;

    // Call Claude
    let aiResult;
    try {
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        system: [{ type: "text", text: READING_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userPrompt }],
      });
      const rawText = message.content[0].text;
      // Robust extraction — find the outermost JSON object even if Claude adds surrounding text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new SyntaxError("No JSON object found in Claude response");
      aiResult = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error("Claude API or parse error:", err);
      await usageRef.transaction((c) => Math.max(0, (c || 1) - 1)).catch(() => {});
      return res.status(500).json({ error: err instanceof SyntaxError ? "parse_failed" : "claude_failed" });
    }

    // Save to Firestore AFTER getting result — only metadata + result, no raw questionsData
    let submissionId = null;
    try {
      const docRef = await db.collection("aiReadingAnalysis").add({
        userId: uid,
        userEmail,
        testId: testId || null,
        testTitle: testTitle || null,
        mode: mode || "without_passage",
        fileName: fileName || "unknown.xlsx",
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "completed",
        aiResult,
      });
      submissionId = docRef.id;
    } catch (err) {
      console.error("Firestore save error (non-fatal):", err);
      // Result is still returned even if Firestore save fails
    }

    return res.status(200).json({ success: true, submissionId, aiResult });
  });
});

/* ═══════════════ Daily Study Plan ═══════════════
   Claude (Haiku — cheap) supplies ONLY personalization: skill weights,
   weekly focus topics and advice. All dates, tasks and test links are
   assembled deterministically in planner.js. One API call per generation,
   rate-limited, with a full non-AI fallback. */

const PLANNER_MODEL = "claude-haiku-4-5";

const PLANNER_SYSTEM_PROMPT = `You are an IELTS study-plan advisor for an exam-prep center.
Given a student profile you return personalization parameters for a deterministic scheduler.
Return ONLY valid JSON, no other text:
{
  "skillWeights": { "reading": <0.5-2>, "listening": <0.5-2>, "writing": <0.5-2>, "speaking": <0.5-2> },
  "weeklyFocuses": [ { "theme": "<short weekly strategy focus>", "vocabTopic": "<IELTS vocabulary topic>", "grammarTopic": "<grammar point>" } ],
  "advice": "<2-3 sentences of specific, honest advice for this student>"
}
Rules:
- Higher weight = the student needs MORE practice in that skill.
- The profile includes the student's self-assessed band per section (currentBands) and
  recent test averages (recentPerformance). Trust recent test data over self-assessment
  for reading/listening; for writing/speaking only self-assessment is available.
- weeklyFocuses: exactly the number of weeks requested, ordered from fundamentals to exam-week polish, no repeated topics.
- Be realistic: if the target is not achievable in the time left, say so in advice and state what is achievable.`;

const RESULT_COLLECTIONS = {
  reading: "resultsReading",
  listening: "resultsListening",
  writing: "resultsWriting",
  fullmock: "resultFullmock",
};

const TEST_COLLECTIONS = {
  reading: "readingTests",
  listening: "listeningTests",
  writing: "writingTests",
  fullmock: "fullmockTests",
};

export const generateStudyPlan = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Only POST requests are allowed" });
    }

    const bearerToken = req.headers.authorization;
    if (!bearerToken?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header." });
    }

    let uid, email;
    try {
      const decoded = await auth.verifyIdToken(bearerToken.split("Bearer ")[1]);
      uid = decoded.uid;
      email = decoded.email || null;
    } catch {
      return res.status(401).json({ error: "Invalid ID token." });
    }

    const input = validatePlanInput(req.body || {});
    if (input.error) {
      return res.status(400).json({ error: input.error });
    }

    // Rate limit: 3 plan generations per week per user
    const weekKey = getWeekKey(new Date());
    const usageRef = admin.database().ref(`planUsage/${uid}/${weekKey}/count`);
    let limitReached = false;
    try {
      await usageRef.transaction((current) => {
        const count = current || 0;
        if (count >= 3) {
          limitReached = true;
          return;
        }
        return count + 1;
      });
    } catch (err) {
      console.error("RTDB transaction error:", err);
      return res.status(500).json({ error: "rate_limit_check_failed" });
    }
    if (limitReached) {
      return res.status(429).json({ error: "limit_reached", used: 3, max: 3 });
    }

    // ── Student stats + already-taken tests (server-side, trusted data) ──
    const skillStats = {};
    const taken = {};
    try {
      await Promise.all(Object.entries(RESULT_COLLECTIONS).map(async ([skill, col]) => {
        const snap = await db.collection(col).where("userId", "==", uid).limit(25).get();
        taken[skill] = new Set();
        const bands = [];
        snap.forEach((d) => {
          const r = d.data();
          if (r.testId) taken[skill].add(r.testId);
          if ((skill === "reading" || skill === "listening") &&
              typeof r.score === "number" && r.total) {
            bands.push(bandFromScore(r.score, r.total));
          }
        });
        skillStats[skill] = {
          testsTaken: snap.size,
          avgBand: bands.length
            ? Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 10) / 10
            : null,
        };
      }));
    } catch (err) {
      console.error("Failed to read results:", err);
      return res.status(500).json({ error: "firestore_failed" });
    }

    // ── Available tests (ids only — listDocuments avoids reading content) ──
    const tests = {};
    try {
      await Promise.all(Object.entries(TEST_COLLECTIONS).map(async ([skill, col]) => {
        const refs = await db.collection(col).listDocuments();
        tests[skill] = refs
          .map((r) => r.id)
          .sort((a, b) => (parseInt(a.match(/\d+/)?.[0] || "0") - parseInt(b.match(/\d+/)?.[0] || "0")));
      }));
    } catch (err) {
      console.error("Failed to list tests:", err);
      return res.status(500).json({ error: "firestore_failed" });
    }

    // ── Personalization: single cheap Claude call, deterministic fallback ──
    const weeks = Math.ceil(input.totalDays / 7);
    let ai = null;
    let generatedWith = "fallback";
    try {
      const profile = {
        currentBand: input.currentBand,
        currentBands: input.currentBands,
        targetBand: input.targetBand,
        daysUntilExam: input.totalDays,
        hoursPerDay: input.hoursPerDay,
        weeklyFocusesRequested: Math.min(weeks, 16),
        recentPerformance: skillStats,
      };
      const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
      const message = await client.messages.create({
        model: PLANNER_MODEL,
        max_tokens: 1500,
        system: [{ type: "text", text: PLANNER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: JSON.stringify(profile) }],
      });
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const w = parsed.skillWeights || {};
        ai = {
          skillWeights: {
            reading: Math.min(2, Math.max(0.5, parseFloat(w.reading) || 1)),
            listening: Math.min(2, Math.max(0.5, parseFloat(w.listening) || 1)),
            writing: Math.min(2, Math.max(0.5, parseFloat(w.writing) || 1)),
            speaking: Math.min(2, Math.max(0.5, parseFloat(w.speaking) || 1)),
          },
          weeklyFocuses: Array.isArray(parsed.weeklyFocuses) ? parsed.weeklyFocuses : null,
          advice: typeof parsed.advice === "string" ? parsed.advice.slice(0, 600) : "",
        };
        generatedWith = "ai";
      }
    } catch (err) {
      console.warn("Planner AI call failed, using fallback:", err.message);
    }
    if (!ai) {
      ai = {
        skillWeights: fallbackWeights(skillStats, input.currentBands, input.targetBand),
        weeklyFocuses: null,
        advice: "",
      };
    }

    // ── Deterministic assembly + save ──
    const plan = buildPlan(input, ai, tests, taken);
    try {
      await db.collection("studyPlans").doc(uid).set({
        userId: uid,
        email,
        currentBand: input.currentBand,
        currentBands: input.currentBands,
        targetBand: input.targetBand,
        examDate: input.examDate,
        startDate: input.startDate,
        hoursPerDay: input.hoursPerDay,
        weeks: plan.weeks,
        totalTasks: plan.totalTasks,
        days: plan.days,
        advice: ai.advice || "",
        skillWeights: ai.skillWeights,
        generatedWith,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to save plan:", err);
      return res.status(500).json({ error: "firestore_save_failed" });
    }

    // Keep the dashboard target card in sync with the plan target
    if (email) {
      try {
        const targetSnap = await db.collection("userTargets")
          .where("email", "==", email).limit(1).get();
        if (!targetSnap.empty) {
          await targetSnap.docs[0].ref.set({ target: input.targetBand }, { merge: true });
        } else {
          await db.collection("userTargets").add({ email, target: input.targetBand });
        }
      } catch (err) {
        console.warn("userTargets sync failed (non-fatal):", err.message);
      }
    }

    return res.status(200).json({ success: true, generatedWith, totalTasks: plan.totalTasks });
  });
});

/* ═══════════════ Daily Plan Telegram bot ═══════════════
   Separate bot (@dailyplan_yes_bot). Students link themselves by sending
   their login email to the bot; a scheduled function then sends them their
   pending tasks every morning. Token lives in functions/.env. */

async function sendDailyPlanBotMessage(chatId, text) {
  const token = process.env.DAILYPLAN_BOT_TOKEN;
  if (!token) {
    console.error("DAILYPLAN_BOT_TOKEN not configured");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) console.error("Daily plan bot API error:", await res.text());
    return res.ok;
  } catch (err) {
    console.error("Daily plan bot send failed:", err);
    return false;
  }
}

function tashkentToday() {
  // YYYY-MM-DD in Asia/Tashkent regardless of server timezone
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
}

function formatTasksMessage(name, day) {
  const pending = day.tasks.filter((t) => t.status === "pending");
  if (!pending.length) return null;
  const totalMin = pending.reduce((sum, t) => sum + (t.minutes || 0), 0);
  let msg = `☀️ Good morning${name ? `, ${name}` : ""}!\n📋 <b>Your study plan for today</b>\n`;
  if (day.focus) msg += `<i>Week focus: ${day.focus}</i>\n`;
  msg += `\n`;
  pending.forEach((t, i) => {
    msg += `${i + 1}. ${t.title}${t.minutes ? ` — ~${t.minutes} min` : ""}\n`;
  });
  msg += `\n⏱ Total: ~${totalMin} min`;
  msg += `\n\nOpen your plan: https://yescenteruz.com/pages/dashboard/#/plan`;
  return msg;
}

// Telegram webhook: /start → ask for email; email → link chat to student
export const dailyPlanBotWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Only POST");
  }
  // Optional shared-secret check (set the same value in setWebhook)
  const secret = process.env.DAILYPLAN_WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(403).send("Forbidden");
  }

  const message = req.body?.message;
  // Always 200 so Telegram doesn't retry forever
  if (!message?.chat?.id || typeof message.text !== "string") {
    return res.status(200).json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  try {
    if (text.startsWith("/start")) {
      await sendDailyPlanBotMessage(chatId,
        "👋 Welcome to <b>YES Daily Plan</b>!\n\n" +
        "I send you your IELTS study tasks every morning at <b>7:00</b> and check " +
        "your progress in the evening at <b>20:00</b>.\n\n" +
        "To connect, send me the <b>email you use to log in</b> on yescenteruz.com.");
    } else if (text.includes("@")) {
      const email = text.toLowerCase();
      const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (userSnap.empty) {
        await sendDailyPlanBotMessage(chatId,
          "❌ I couldn't find a student with that email. " +
          "Make sure you send exactly the email you log in with.");
      } else {
        const userDoc = userSnap.docs[0];
        await db.collection("telegramLinks").doc(chatId).set({
          chatId,
          email,
          userId: userDoc.id,
          name: userDoc.data().name || null,
          linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await sendDailyPlanBotMessage(chatId,
          `✅ Connected, ${userDoc.data().name || "student"}! Your Daily Plan is now linked.\n\n` +
          "☀️ Every morning at <b>7:00</b> I'll send your tasks for the day.\n" +
          "🌙 At <b>20:00</b> I'll remind you if something isn't finished.\n\n" +
          "Create or view your plan here: https://yescenteruz.com/pages/dashboard/#/plan\n\n" +
          "Send /stop to turn reminders off.");
      }
    } else if (text.startsWith("/stop")) {
      await db.collection("telegramLinks").doc(chatId).delete();
      await sendDailyPlanBotMessage(chatId, "🔕 Reminders are off. Send your email again to re-enable them.");
    } else {
      await sendDailyPlanBotMessage(chatId,
        "Please send the email you use to log in on the site (it contains @).");
    }
  } catch (err) {
    console.error("Webhook handling error:", err);
  }

  return res.status(200).json({ ok: true });
});

// Server-side auto-complete: mark site tasks done when a matching test
// result exists (same rule as the dashboard, but works even if the student
// never opens the plan page). Returns the up-to-date plan data.
async function autoMarkPlanTasks(uid, planSnap) {
  const plan = planSnap.data();
  const createdMs = plan.createdAt?.toMillis ? plan.createdAt.toMillis() : 0;
  const doneTests = {};
  await Promise.all(Object.entries(RESULT_COLLECTIONS).map(async ([type, col]) => {
    const snap = await db.collection(col).where("userId", "==", uid).limit(50).get();
    doneTests[type] = new Set();
    snap.forEach((d) => {
      const r = d.data();
      const ms = r.createdAt?.toMillis?.() || r.submittedAt?.toMillis?.() ||
        (typeof r.submittedAt === "string" ? (Date.parse(r.submittedAt) || 0) : 0);
      if (r.testId && ms >= createdMs) doneTests[type].add(r.testId);
    });
  }));

  let changed = false;
  const days = plan.days.map((day) => ({
    ...day,
    tasks: day.tasks.map((t) => {
      if (t.kind === "site" && t.status === "pending" && doneTests[t.type]?.has(t.testId)) {
        changed = true;
        return { ...t, status: "auto" };
      }
      return t;
    }),
  }));
  if (changed) {
    await planSnap.ref.update({ days });
    return { ...plan, days };
  }
  return plan;
}

// Every morning: send each linked student their pending tasks for today
export const sendDailyPlanReminders = onSchedule(
  { schedule: "every day 07:00", timeZone: "Asia/Tashkent" },
  async () => {
    const today = tashkentToday();
    const links = await db.collection("telegramLinks").get();
    if (links.empty) return;

    for (const link of links.docs) {
      const { chatId, userId, name } = link.data();
      try {
        const planSnap = await db.collection("studyPlans").doc(userId).get();
        if (!planSnap.exists) continue;
        const plan = await autoMarkPlanTasks(userId, planSnap);
        const day = plan.days?.find((d) => d.date === today);
        if (!day) continue;
        const msg = formatTasksMessage(name, day);
        if (msg) await sendDailyPlanBotMessage(chatId, msg);
      } catch (err) {
        console.error(`Reminder failed for chat ${chatId}:`, err);
      }
    }
  }
);

// Every evening: nudge students who haven't finished today's tasks
export const sendEveningNudges = onSchedule(
  { schedule: "every day 20:00", timeZone: "Asia/Tashkent" },
  async () => {
    const today = tashkentToday();
    const links = await db.collection("telegramLinks").get();
    if (links.empty) return;

    for (const link of links.docs) {
      const { chatId, userId, name } = link.data();
      try {
        const planSnap = await db.collection("studyPlans").doc(userId).get();
        if (!planSnap.exists) continue;
        const plan = await autoMarkPlanTasks(userId, planSnap);
        const day = plan.days?.find((d) => d.date === today);
        if (!day) continue;

        const real = day.tasks.filter((t) => t.type !== "rest");
        const pending = real.filter((t) => t.status === "pending");
        if (!real.length || !pending.length) continue; // rest day or all done

        const totalMin = pending.reduce((sum, t) => sum + (t.minutes || 0), 0);
        let msg;
        if (pending.length === real.length) {
          msg = `🌙 ${name ? `${name}, y` : "Y"}ou haven't started today's plan yet!\n\n`;
        } else {
          msg = `🌙 Almost there${name ? `, ${name}` : ""} — <b>${pending.length} task${pending.length > 1 ? "s" : ""} left</b> today:\n\n`;
        }
        pending.forEach((t, i) => {
          msg += `${i + 1}. ${t.title}${t.minutes ? ` — ~${t.minutes} min` : ""}\n`;
        });
        msg += `\n⏱ About ${totalMin} min to finish. Every completed day brings you closer to Band ${plan.targetBand} 💪`;
        msg += `\n\nhttps://yescenteruz.com/pages/dashboard/#/plan`;
        await sendDailyPlanBotMessage(chatId, msg);
      } catch (err) {
        console.error(`Evening nudge failed for chat ${chatId}:`, err);
      }
    }
  }
);
