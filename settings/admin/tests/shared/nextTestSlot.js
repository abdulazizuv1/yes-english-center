// ═══════════════════════════════════════════════════════════════════════
// Which number does the next test get?
//
// Deleting a test leaves a hole in the numbering (listening jumps 14, 16,
// 17, 19). New tests fill the lowest free hole instead of always taking
// max+1 — but ONLY when that hole is truly free.
//
// A hole is NOT free while student results still reference it: reusing
// such an id would hand the new test somebody else's marks, show it as
// "already taken" to everyone who sat the deleted test, and auto-tick
// their daily-plan tasks. listening test-15 (40 results from 25 students)
// and test-18 (21 results) are exactly this case, so they stay skipped.
//
// Shared by all four add tools.
// ═══════════════════════════════════════════════════════════════════════
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// last run of digits: "test-23" → 23
const numberOf = (id) => {
  const m = String(id ?? "").match(/(\d+)(?!.*\d)/);
  return m ? parseInt(m[1], 10) : null;
};

/**
 * @returns {Promise<{number:number, reused:boolean, skipped:number[]}>}
 *   number  — the number the new test should be saved under
 *   reused  — true when it fills a hole rather than extending the range
 *   skipped — holes left alone because results still reference them
 */
export async function findNextTestSlot(db, testCollection, resultCollection) {
  const snap = await getDocs(collection(db, testCollection));

  const taken = new Set();
  let max = 0;
  snap.forEach((d) => {
    const n = numberOf(d.id);
    if (n === null) return;
    taken.add(n);
    if (n > max) max = n;
  });

  const skipped = [];
  for (let n = 1; n < max; n++) {
    if (taken.has(n)) continue;
    if (await slotHasHistory(db, resultCollection, `test-${n}`)) {
      skipped.push(n);
      continue;
    }
    return { number: n, reused: true, skipped };
  }

  return { number: max + 1, reused: false, skipped };
}

async function slotHasHistory(db, resultCollection, testId) {
  if (!resultCollection) return true; // can't verify → never reuse
  try {
    const snap = await getDocs(
      query(collection(db, resultCollection), where("testId", "==", testId), limit(1))
    );
    return !snap.empty;
  } catch (err) {
    // A rules/network failure must not silently hand out an id that
    // already carries student history.
    console.warn(`Could not check ${resultCollection} for ${testId}; treating the slot as taken.`, err);
    return true;
  }
}

/** Badge text for the admin: makes a reused number obvious. */
export function slotLabel(slot, label = "Test") {
  if (!slot.reused) return `${label} ${slot.number}`;
  return `${label} ${slot.number} — filling a free slot`;
}
