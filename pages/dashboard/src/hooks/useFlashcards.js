/* ═══════════════════════════════════════════════════════════════════
   Flashcards — one Firestore collection, `flashcardSets`:

     { title, description,
       scope: "personal" | "shared",   // shared sets are visible to everyone
       ownerId, ownerName,
       cards: [{ term, definition, example }],
       createdAt, updatedAt }

   Students create personal sets; admins can also publish shared ones.
   Which cards a student has learned is kept in localStorage — it is
   per-person, changes constantly, and nothing else needs to read it.
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
    collection, query, where, getDocs, doc, getDoc,
    addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';

const COL = 'flashcardSets';

const toSet = (d) => ({ id: d.id, ...d.data() });

// newest first; sets without a timestamp (just created) come first
const byNewest = (a, b) => {
    const ta = a.createdAt?.toMillis?.() ?? Date.now();
    const tb = b.createdAt?.toMillis?.() ?? Date.now();
    return tb - ta;
};

/** Shared sets + the current user's own sets. */
export function useFlashcardSets(userId) {
    const [shared, setShared] = useState([]);
    const [mine, setMine] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            // Two separate queries, each matching a rule on its own, so the
            // security rules can allow them without opening up the collection.
            const [sharedSnap, mineSnap] = await Promise.all([
                getDocs(query(collection(db, COL), where('scope', '==', 'shared'))),
                userId
                    ? getDocs(query(collection(db, COL), where('ownerId', '==', userId)))
                    : Promise.resolve({ docs: [] }),
            ]);
            const sharedSets = sharedSnap.docs.map(toSet).sort(byNewest);
            // a shared set the user owns shows up in both queries — keep it in "shared"
            const sharedIds = new Set(sharedSets.map((s) => s.id));
            setShared(sharedSets);
            setMine(mineSnap.docs.map(toSet).filter((s) => !sharedIds.has(s.id)).sort(byNewest));
        } catch (err) {
            console.error('Failed to load flashcard sets:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    return { shared, mine, loading, reload: load };
}

/** A single set, for studying or editing. */
export function useFlashcardSet(setId) {
    const [set, setSet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!setId) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, COL, setId));
                if (cancelled) return;
                if (!snap.exists()) setError('This set no longer exists.');
                else setSet(toSet(snap));
            } catch (err) {
                console.error('Failed to load set:', err);
                if (!cancelled) setError('Could not open this set.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [setId]);

    return { set, loading, error };
}

export async function createSet({ title, description, cards, scope, user }) {
    const ref = await addDoc(collection(db, COL), {
        title: title.trim(),
        description: (description || '').trim(),
        scope,                       // "personal" or "shared"
        ownerId: user.uid,
        ownerName: user.email || 'unknown',
        cards: cleanCards(cards),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function saveSet(setId, { title, description, cards }) {
    await updateDoc(doc(db, COL, setId), {
        title: title.trim(),
        description: (description || '').trim(),
        cards: cleanCards(cards),
        updatedAt: serverTimestamp(),
    });
}

export async function deleteSet(setId) {
    await deleteDoc(doc(db, COL, setId));
}

/** Drop blank rows and trim — a card needs at least a term and a meaning. */
export function cleanCards(cards) {
    return (cards || [])
        .map((c) => ({
            term: (c.term || '').trim(),
            definition: (c.definition || '').trim(),
            example: (c.example || '').trim(),
        }))
        .filter((c) => c.term && c.definition);
}

/* ─── learned marks: per person, per set, kept on the device ─── */

const progressKey = (setId) => `flashcards:${setId}:learned`;

export function loadLearned(setId) {
    try {
        return new Set(JSON.parse(localStorage.getItem(progressKey(setId)) || '[]'));
    } catch {
        return new Set();
    }
}

export function saveLearned(setId, learnedSet) {
    try {
        localStorage.setItem(progressKey(setId), JSON.stringify([...learnedSet]));
    } catch (err) {
        console.warn('Could not save flashcard progress:', err);
    }
}

/* ─────────────────────────────────────────────────────────────
   Bringing words in from somewhere else, and taking them out.

   People arrive with a list they already have: a Quizlet export, two
   columns from a spreadsheet, or lines they typed themselves. These turn
   that text into cards and back again. Pure functions, no DOM.
   ───────────────────────────────────────────────────────────── */

const COLUMN_SEPARATORS = { tab: '\t', comma: ',', dash: ' - ', semicolon: ';' };

/** Guesses how the pasted list separates a word from its meaning. */
export function detectSeparator(text) {
    const rows = String(text || '').split(/\r?\n/).filter((r) => r.trim());
    if (!rows.length) return 'tab';
    const hits = (needle) => rows.filter((r) => r.includes(needle)).length;
    if (hits('\t') >= rows.length / 2) return 'tab';
    if (hits(' - ') >= rows.length / 2) return 'dash';
    if (hits(';') >= rows.length / 2) return 'semicolon';
    if (hits(',') >= rows.length / 2) return 'comma';
    return 'tab';
}

/**
 * Pasted text to cards.
 * @param {string} text        what the person pasted
 * @param {object} opts        { between: 'auto'|'tab'|'comma'|'dash'|'semicolon'|'custom',
 *                               customBetween: string,
 *                               rows: 'newline'|'semicolon'|'custom', customRows: string }
 */
export function parseImport(text, opts = {}) {
    const raw = String(text || '');
    if (!raw.trim()) return [];

    const rowMode = opts.rows || 'newline';
    const rowSep = rowMode === 'custom' ? (opts.customRows || '\n')
        : rowMode === 'semicolon' ? ';'
            : '\n';

    const betweenMode = opts.between && opts.between !== 'auto' ? opts.between : detectSeparator(raw);
    const colSep = betweenMode === 'custom'
        ? (opts.customBetween || '\t')
        : (COLUMN_SEPARATORS[betweenMode] || '\t');

    const rows = rowSep === '\n' ? raw.split(/\r?\n/) : raw.split(rowSep);

    return rows
        .map((row) => {
            const line = row.trim();
            if (!line) return null;
            const parts = line.split(colSep);
            if (parts.length < 2) return null;

            // A tab-separated list is really columns, so a third column is the
            // example. With any other separator the meaning may well contain
            // one, so everything after the first separator stays together.
            const term = parts[0].trim();
            let definition;
            let example = '';
            if (colSep === '\t') {
                definition = (parts[1] || '').trim();
                example = parts.slice(2).join(' ').trim();
            } else {
                definition = parts.slice(1).join(colSep).trim();
            }
            if (!term || !definition) return null;
            return { term, definition, example };
        })
        .filter(Boolean);
}

/** Cards back to text, in the shape parseImport reads. */
export function toExportText(cards) {
    return (cards || [])
        .map((c) => [c.term, c.definition, c.example].filter(Boolean).join('\t'))
        .join('\n');
}
