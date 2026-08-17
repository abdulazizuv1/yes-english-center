import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFlashcardSet, loadLearned, saveLearned } from '../hooks/useFlashcards';
import {
    ArrowLeft, Shuffle, RotateCcw, Check, X as XIcon,
    ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react';
import './StudySet.css';
import {
    grabPoint, dragAngle, isThrown, throwDirection, flightTransform, leanAmount,
} from './swipePhysics';

function SwipeCard({ card, index, flipped, onFlip, onSwipe }) {
    const cardRef = useRef(null);
    const drag = useRef(null);

    // new card → clear whatever transform the previous throw left behind
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        el.style.transition = 'none';
        el.style.transform = '';
        el.style.opacity = '';
        // force a reflow so the next transition starts from this clean state
        void el.offsetWidth;
        el.style.transition = '';
        el.classList.remove('throwing');
    }, [index]);

    const paint = (dx, dy, angle, opacity = 1) => {
        const el = cardRef.current;
        if (!el) return;
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle}deg)`;
        el.style.opacity = String(opacity);
        // tint the card towards green/red as it approaches the threshold
        el.style.setProperty('--lean', String(leanAmount(dx)));
    };

    const onPointerDown = (e) => {
        // let clicks on the buttons inside the card through
        if (e.target.closest('button')) return;
        const el = cardRef.current;
        const rect = el.getBoundingClientRect();
        el.setPointerCapture?.(e.pointerId);
        el.style.transition = 'none';
        drag.current = {
            startX: e.clientX,
            startY: e.clientY,
            grabY: grabPoint(e.clientY, rect),
            lastX: e.clientX,
            lastT: performance.now(),
            vx: 0,
            moved: false,
        };
    };

    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;

        const now = performance.now();
        const dt = now - d.lastT;
        if (dt > 0) d.vx = (e.clientX - d.lastX) / dt;
        d.lastX = e.clientX;
        d.lastT = now;

        paint(dx, dy, dragAngle(dx, d.grabY));
    };

    const onPointerUp = (e) => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        const el = cardRef.current;
        el?.releasePointerCapture?.(e.pointerId);

        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;

        // a tap (no real movement) flips the card instead
        if (!d.moved) {
            el.style.transition = '';
            paint(0, 0, 0);
            onFlip();
            return;
        }

        if (isThrown(dx, d.vx)) {
            // keep flying the way it was thrown, spinning about the grab point
            const flight = flightTransform({
                dx, dy, vx: d.vx, grabY: d.grabY,
                viewportWidth: window.innerWidth || 1200,
            });
            el.classList.add('throwing');
            el.style.transition = 'transform .42s cubic-bezier(.22,.61,.36,1), opacity .42s ease';
            paint(flight.x, flight.y, flight.angle, 0);
            const dir = throwDirection(dx, d.vx);
            setTimeout(() => onSwipe(dir > 0 ? 'right' : 'left'), 260);
        } else {
            // not far enough — spring back to the deck
            el.style.transition = 'transform .32s cubic-bezier(.2,.8,.3,1), opacity .2s';
            paint(0, 0, 0);
        }
    };

    return (
        <div
            className={`fc-card ${flipped ? 'flipped' : ''}`}
            ref={cardRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
        >
            <div className="fc-face fc-front">
                <span className="fc-badge know"><Check size={14} /> Know it</span>
                <span className="fc-badge learning"><XIcon size={14} /> Still learning</span>
                <div className="fc-term">{card.term}</div>
                <div className="fc-hint">Tap to flip · drag to sort</div>
            </div>
            <div className="fc-face fc-back">
                <div className="fc-back-term">{card.term}</div>
                <div className="fc-label">Meaning</div>
                <div className="fc-def">{card.definition}</div>
                {card.example && (
                    <>
                        <div className="fc-label">Example</div>
                        <div className="fc-example">{card.example}</div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function StudySet() {
    const { setId } = useParams();
    const { set, loading, error } = useFlashcardSet(setId);

    const [pos, setPos] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [learned, setLearned] = useState(() => loadLearned(setId));
    // null = the set's own order; an array = a shuffled order of indexes
    const [order, setOrder] = useState(null);

    // The deck follows the set, so nothing has to be copied into state
    // when it loads. Card ids stay tied to the original position, which is
    // what the saved "learned" marks refer to.
    const cards = useMemo(
        () => (set?.cards || []).map((c, i) => ({ ...c, id: i })),
        [set]
    );
    const deck = useMemo(
        () => (order ? order.map((i) => cards[i]).filter(Boolean) : cards),
        [cards, order]
    );

    const total = deck.length;
    const safePos = total ? Math.min(pos, total - 1) : 0;
    const card = deck[safePos];

    const go = useCallback((delta) => {
        if (!total) return;
        setFlipped(false);
        setPos((p) => (p + delta + total) % total);
    }, [total]);

    const mark = useCallback((cardId, known) => {
        setLearned((prev) => {
            const next = new Set(prev);
            if (known) next.add(cardId); else next.delete(cardId);
            saveLearned(setId, next);
            return next;
        });
    }, [setId]);

    const handleSwipe = useCallback((direction) => {
        if (!card) return;
        mark(card.id, direction === 'right');
        go(1);
    }, [card, mark, go]);

    const shuffle = () => {
        const next = cards.map((_, i) => i);
        for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
        }
        setOrder(next);
        setPos(0);
        setFlipped(false);
    };

    const resetProgress = () => {
        if (!confirm('Clear your progress for this set?')) return;
        const empty = new Set();
        setLearned(empty);
        saveLearned(setId, empty);
    };

    // keyboard: the same shortcuts the practice page in the brief used
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.matches('input, textarea')) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
            else if (e.key === 'Enter' && card) { e.preventDefault(); mark(card.id, !learned.has(card.id)); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, card, mark, learned]);

    if (loading) return <div className="study-page page-enter"><div className="fc-loading">Loading set…</div></div>;
    if (error || !set) {
        return (
            <div className="study-page page-enter">
                <Link to="/flashcards" className="fc-back"><ArrowLeft size={18} /> Back to flashcards</Link>
                <div className="fc-empty-card"><p>{error || 'Set not found.'}</p></div>
            </div>
        );
    }

    const knownCount = learned.size;
    const progress = total ? Math.round((knownCount / total) * 100) : 0;

    return (
        <div className="study-page page-enter">
            <div className="study-top">
                <Link to="/flashcards" className="fc-back"><ArrowLeft size={18} /> All sets</Link>
                <div className="study-title">
                    <h2>{set.title}</h2>
                    {set.description && <p>{set.description}</p>}
                </div>
                <Link to={`/flashcards/${setId}/edit`} className="fc-icon-btn" title="Edit set">
                    <Pencil size={16} />
                </Link>
            </div>

            <div className="study-bar">
                <div className="study-progress">
                    <div className="study-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="study-progress-text">{knownCount} / {total} known</span>
                <button className="fc-btn" onClick={shuffle}><Shuffle size={15} /> Shuffle</button>
                <button className="fc-btn" onClick={resetProgress}><RotateCcw size={15} /> Reset</button>
            </div>

            {total === 0 ? (
                <div className="fc-empty-card">
                    <p>This set has no cards yet.</p>
                    <Link to={`/flashcards/${setId}/edit`} className="fc-new-btn">Add cards</Link>
                </div>
            ) : (
                <>
                    <div className="fc-stage">
                        {/* two dummies behind, so it reads as a deck */}
                        <div className="fc-stack fc-stack-2" />
                        <div className="fc-stack fc-stack-1" />
                        <SwipeCard
                            key={card.id}
                            card={card}
                            index={safePos}
                            flipped={flipped}
                            onFlip={() => setFlipped((f) => !f)}
                            onSwipe={handleSwipe}
                        />
                    </div>

                    <div className="study-nav">
                        <button className="fc-btn" onClick={() => go(-1)}><ChevronLeft size={16} /> Prev</button>
                        <button
                            className={`fc-btn learn ${learned.has(card.id) ? 'on' : ''}`}
                            onClick={() => mark(card.id, !learned.has(card.id))}
                        >
                            <Check size={16} /> {learned.has(card.id) ? 'Known' : 'Mark known'}
                        </button>
                        <span className="study-counter"><b>{safePos + 1}</b> / {total}</span>
                        <button className="fc-btn primary" onClick={() => go(1)}>Next <ChevronRight size={16} /></button>
                    </div>

                    <p className="study-help">
                        Drag right if you know it, left to keep practising ·
                        <kbd>←</kbd><kbd>→</kbd> move · <kbd>Space</kbd> flip · <kbd>Enter</kbd> mark
                    </p>
                </>
            )}
        </div>
    );
}
