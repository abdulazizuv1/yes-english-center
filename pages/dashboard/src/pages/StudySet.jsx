import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFlashcardSet, loadLearned, saveLearned, toExportText } from '../hooks/useFlashcards';
import {
    ArrowLeft, Shuffle, RotateCcw, Check, X as XIcon,
    ChevronLeft, ChevronRight, Pencil, Download, PartyPopper,
} from 'lucide-react';
import './StudySet.css';
import {
    grabPoint, dragAngle, isThrown, throwDirection, flightTransform, leanAmount,
} from './swipePhysics';

function SwipeCard({ card, deal, flipped, onFlip, onSwipe }) {
    const cardRef = useRef(null);
    const drag = useRef(null);
    const flippedRef = useRef(flipped);

    /* The card's transform belongs to JavaScript alone. The flip used to live
       in a CSS class, and the first tap wrote an inline transform that beat
       it, so the card never turned over. One owner, one source of truth. */
    const paint = useCallback((dx, dy, angle, opacity = 1) => {
        const el = cardRef.current;
        if (!el) return;
        const flip = flippedRef.current ? ' rotateY(180deg)' : '';
        el.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle}deg)${flip}`;
        el.style.opacity = String(opacity);
        el.style.setProperty('--lean', String(leanAmount(dx)));
    }, []);

    /* A fresh deal always gets a fresh card, even when the position number
       happens to repeat (a one-card set advancing onto itself). Without this
       the thrown card kept its opacity 0 and never came back. */
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        el.style.transition = 'none';
        el.style.opacity = '1';
        el.classList.remove('throwing');
        drag.current = null;
        paint(0, 0, 0);
        void el.offsetWidth;      // let that land before transitions return
        el.style.transition = '';
    }, [deal, paint]);

    // flipping at rest: repaint through the same channel so it animates
    useEffect(() => {
        flippedRef.current = flipped;
        const el = cardRef.current;
        if (!el || drag.current) return;
        el.style.transition = '';
        paint(0, 0, 0);
    }, [flipped, paint]);

    const onPointerDown = (e) => {
        if (e.target.closest('button')) return;   // let buttons inside work
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

        // no real movement: this was a tap, so turn the card over
        if (!d.moved) {
            el.style.transition = '';
            onFlip();
            return;
        }

        if (isThrown(dx, d.vx)) {
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
            el.style.transition = 'transform .32s cubic-bezier(.2,.8,.3,1), opacity .2s';
            paint(0, 0, 0);
        }
    };

    return (
        <div
            className="fc-card"
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
            <div className="fc-face fc-card-back">
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
    const [deal, setDeal] = useState(0);       // counts every card handed over
    const [flipped, setFlipped] = useState(false);
    const [learned, setLearned] = useState(() => loadLearned(setId));
    const [order, setOrder] = useState(null);  // null = the set's own order

    const cards = useMemo(
        () => (set?.cards || []).map((c, i) => ({ ...c, id: i })),
        [set]
    );
    const deck = useMemo(
        () => (order ? order.map((i) => cards[i]).filter(Boolean) : cards),
        [cards, order]
    );

    const total = deck.length;
    const safePos = total ? Math.min(pos, total) : 0;   // total itself = finished
    const finished = total > 0 && safePos >= total;
    const card = finished ? null : deck[safePos];

    /* The deck runs to the end and stops there, the way a real stack of cards
       does. It used to wrap around forever, which on a one-card set meant
       every button appeared to do nothing at all. */
    const go = useCallback((delta) => {
        if (!total) return;
        setFlipped(false);
        setDeal((d) => d + 1);
        setPos((p) => Math.max(0, Math.min(total, p + delta)));
    }, [total]);

    const restart = useCallback(() => {
        setFlipped(false);
        setDeal((d) => d + 1);
        setPos(0);
    }, []);

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
        restart();
    };

    const practiseUnknown = () => {
        const missed = cards.map((_, i) => i).filter((i) => !learned.has(i));
        if (!missed.length) return;
        setOrder(missed);
        restart();
    };

    const resetProgress = () => {
        if (!confirm('Clear your progress for this set?')) return;
        const empty = new Set();
        setLearned(empty);
        saveLearned(setId, empty);
        setOrder(null);
        restart();
    };

    const exportCards = async () => {
        const text = toExportText(cards);
        try {
            await navigator.clipboard.writeText(text);
            alert(`Copied ${cards.length} card${cards.length === 1 ? '' : 's'}. Paste them anywhere, or into another set.`);
        } catch {
            // clipboard blocked: hand them a file instead
            const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(set?.title || 'flashcards').replace(/[^\w\s-]/g, '')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === ' ') { e.preventDefault(); if (!finished) setFlipped((f) => !f); }
            else if (e.key === 'Enter' && card) { e.preventDefault(); mark(card.id, !learned.has(card.id)); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [go, card, mark, learned, finished]);

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
    const missedCount = cards.length - knownCount;

    return (
        <div className="study-page page-enter">
            <div className="study-top">
                <Link to="/flashcards" className="fc-back"><ArrowLeft size={18} /> All sets</Link>
                <div className="study-title">
                    <h2>{set.title}</h2>
                    {set.description && <p>{set.description}</p>}
                </div>
                <button className="fc-icon-btn" onClick={exportCards} title="Copy all cards as text">
                    <Download size={16} />
                </button>
                <Link to={`/flashcards/${setId}/edit`} className="fc-icon-btn" title="Edit set">
                    <Pencil size={16} />
                </Link>
            </div>

            <div className="study-bar">
                <div className="study-progress">
                    <div className="study-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="study-progress-text">{knownCount} / {cards.length} known</span>
                <button className="fc-btn" onClick={shuffle}><Shuffle size={15} /> Shuffle</button>
                <button className="fc-btn" onClick={resetProgress}><RotateCcw size={15} /> Reset</button>
            </div>

            {total === 0 ? (
                <div className="fc-empty-card">
                    <p>This set has no cards yet.</p>
                    <Link to={`/flashcards/${setId}/edit`} className="fc-new-btn">Add cards</Link>
                </div>
            ) : finished ? (
                <div className="fc-done">
                    <PartyPopper size={40} strokeWidth={1.5} />
                    <h3>That is the whole set.</h3>
                    <p>
                        You marked <b>{knownCount}</b> of <b>{cards.length}</b> as known
                        {missedCount > 0
                            ? `, and ${missedCount} still ${missedCount === 1 ? 'needs' : 'need'} work.`
                            : '. Nothing left to practise.'}
                    </p>
                    <div className="fc-done-actions">
                        {missedCount > 0 && (
                            <button className="fc-new-btn" onClick={practiseUnknown}>
                                Practise the {missedCount} you missed
                            </button>
                        )}
                        <button className="fc-btn" onClick={() => { setOrder(null); restart(); }}>
                            <RotateCcw size={15} /> Study again
                        </button>
                        <Link to="/flashcards" className="fc-btn">All sets</Link>
                    </div>
                    <button className="fc-link-btn" onClick={() => go(-1)}>Back to the last card</button>
                </div>
            ) : (
                <>
                    <div className="fc-stage">
                        {/* two dummies behind, so it reads as a deck */}
                        <div className="fc-stack fc-stack-2" />
                        <div className="fc-stack fc-stack-1" />
                        <SwipeCard
                            key={deal}
                            card={card}
                            deal={deal}
                            flipped={flipped}
                            onFlip={() => setFlipped((f) => !f)}
                            onSwipe={handleSwipe}
                        />
                    </div>

                    <div className="study-nav">
                        <button className="fc-btn" onClick={() => go(-1)} disabled={safePos === 0}>
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button
                            className={`fc-btn learn ${learned.has(card.id) ? 'on' : ''}`}
                            onClick={() => mark(card.id, !learned.has(card.id))}
                        >
                            <Check size={16} /> {learned.has(card.id) ? 'Known' : 'Mark known'}
                        </button>
                        <span className="study-counter"><b>{safePos + 1}</b> / {total}</span>
                        <button className="fc-btn primary" onClick={() => go(1)}>
                            {safePos === total - 1 ? 'Finish' : 'Next'} <ChevronRight size={16} />
                        </button>
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
