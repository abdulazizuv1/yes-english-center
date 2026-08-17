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
