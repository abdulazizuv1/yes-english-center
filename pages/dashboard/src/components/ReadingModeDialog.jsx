import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlarmClock, ArrowRight, BookOpen, CircleCheck, Eraser, Highlighter,
    Info, Infinity as InfinityIcon, Lock, Timer, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTestUrl } from '../hooks/useResults';
import './ReadingModeDialog.css';

// A sitting in progress lives on this computer, where the reading test
// keeps it (pages/mock/reading/components/session.js: one key per mode).
// It is only read here, to say "in progress" on the matching card.
function sittingNote(uid, testId, mode) {
    if (!uid || !testId) return null;
    let s = null;
    try {
        const key = `ielts-reading:v2:${uid}:${testId}${mode === 'analyse' ? ':analyse' : ''}`;
        s = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
        return null;
    }
    if (!s || !s.startedAt) return null;
    if (s.finished) return 'Answers waiting to be sent';
    if (mode === 'analyse') {
        const mins = Math.floor((s.elapsed || 0) / 60000);
        return mins > 0 ? `In progress · ${mins} min spent` : 'In progress';
    }
    if (s.pausedAt) return 'In progress · paused';
    const left = (s.deadline || 0) - Date.now();
    return left > 0 ? `In progress · ${Math.ceil(left / 60000)} min left` : 'Time is up';
}

const MODES = [
    {
        id: 'mock',
        icon: <Timer size={22} />,
        name: 'Mock test',
        tagline: 'Real exam conditions',
        facts: [
            [<AlarmClock size={15} aria-hidden="true" />, '60-minute countdown'],
            [<Lock size={15} aria-hidden="true" />, 'The clock cannot be paused'],
            [<CircleCheck size={15} aria-hidden="true" />, 'Submitted by itself when time is up'],
        ],
        cta: 'Start mock test',
    },
    {
        id: 'analyse',
        icon: <InfinityIcon size={22} />,
        name: 'Analyse mode',
        tagline: 'Work through it at your own pace',
        facts: [
            [<Timer size={15} aria-hidden="true" />, 'No time limit, the clock counts up'],
            [<Highlighter size={15} aria-hidden="true" />, 'Highlight and take notes as you go'],
            [<Eraser size={15} aria-hidden="true" />, 'Clear all to start the test again'],
        ],
        cta: 'Start analyse mode',
    },
];

/**
 * Asks how to take a reading test: the timed mock, or analyse mode with no
 * time limit. Both save the same result.
 *
 * test    — { id, title }
 * newTab  — open the test in a new tab (the daily plan does) and close
 */
export default function ReadingModeDialog({ test, onClose, newTab = false }) {
    const { user } = useAuth();
    const firstRef = useRef(null);
    const closeRef = useRef(onClose);
    const [notes] = useState(() => ({
        mock: sittingNote(user?.uid, test.id, 'mock'),
        analyse: sittingNote(user?.uid, test.id, 'analyse'),
    }));

    useEffect(() => { closeRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const opener = document.activeElement;
        firstRef.current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            opener?.focus?.();
        };
    }, []);

    const choose = (mode) => {
        const url = getTestUrl('reading', test.id, mode);
        if (newTab) {
            window.open(url, '_blank', 'noopener');
            onClose();
        } else {
            window.location.assign(url);
        }
    };

    return createPortal(
        <div className="rmode-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="rmode-dialog" role="dialog" aria-modal="true" aria-labelledby="rmode-title" aria-describedby="rmode-desc">
                <header className="rmode-head">
                    <span className="rmode-head-icon"><BookOpen size={20} /></span>
                    <div className="rmode-head-text">
                        <h3 id="rmode-title">{test.title}</h3>
                        <p id="rmode-desc">How would you like to take this test?</p>
                    </div>
                    <button type="button" className="rmode-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </header>

                <div className="rmode-options">
                    {MODES.map(({ id, icon, name, tagline, facts, cta }, i) => (
                        <button
                            key={id}
                            ref={i === 0 ? firstRef : undefined}
                            type="button"
                            className={`rmode-option rmode-${id}`}
                            onClick={() => choose(id)}
                            aria-labelledby={`rmode-${id}-name`}
                            aria-describedby={`rmode-${id}-desc`}
                        >
                            <span className="rmode-option-top">
                                <span className="rmode-icon">{icon}</span>
                                {notes[id] && <span className="rmode-chip">{notes[id]}</span>}
                            </span>
                            <span className="rmode-name" id={`rmode-${id}-name`}>{name}</span>
                            <span className="rmode-desc" id={`rmode-${id}-desc`}>
                                <span className="rmode-tagline">{tagline}</span>
                                {facts.map(([factIcon, text]) => (
                                    <span className="rmode-fact" key={text}>{factIcon}{text}</span>
                                ))}
                            </span>
                            <span className="rmode-cta" aria-hidden="true">
                                {notes[id] ? 'Continue' : cta} <ArrowRight size={16} />
                            </span>
                        </button>
                    ))}
                </div>

                <p className="rmode-note">
                    <Info size={15} aria-hidden="true" />
                    Both modes save your result the same way: your score, band and every answer.
                </p>
            </div>
        </div>,
        document.body
    );
}
