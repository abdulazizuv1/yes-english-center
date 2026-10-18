import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    AlarmClock, ArrowRight, BookOpen, CircleCheck, Eraser, Headphones, Highlighter,
    Info, Infinity as InfinityIcon, Lock, Pause, Repeat, Rewind, Timer, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTestUrl } from '../hooks/useResults';
import './TestModeDialog.css';

/* ───────────── a sitting already in progress on this computer ───────────── */

// The reading and listening tests keep a sitting in progress in this
// browser (pages/mock/{reading,listening}/components/session.js, one key per
// mode). It is only read here, to say "in progress" on the matching card.
const GAP_MS = 1000;            // listening: silence between recording files (audio.js)
const CHECK_MS = 2 * 60 * 1000; // listening: checking time after the recording

function readSitting(type, uid, testId, mode) {
    try {
        const key = `ielts-${type}:v2:${uid}:${testId}${mode === 'analyse' ? ':analyse' : ''}`;
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
        return null;
    }
}

/** ms left in a mock sitting, or null when that cannot be told */
function mockTimeLeft(type, s) {
    if (type === 'reading') return s.pausedAt ? null : (s.deadline || 0) - Date.now();
    const d = s.durations || [];
    if (s.anchor == null || !d.length || d.some((x) => !(x > 0))) return null;
    const total = d.reduce((sum, x) => sum + x * 1000, 0) + (d.length - 1) * GAP_MS + CHECK_MS;
    return total - (Date.now() - s.anchor);
}

function sittingNote(type, uid, testId, mode) {
    if (!uid || !testId) return null;
    const s = readSitting(type, uid, testId, mode);
    if (!s || !s.startedAt) return null;
    if (s.finished) return 'Answers waiting to be sent';
    if (mode === 'analyse') {
        const mins = Math.floor((s.elapsed || 0) / 60000);
        return mins > 0 ? `In progress · ${mins} min spent` : 'In progress';
    }
    const left = mockTimeLeft(type, s);
    if (left === null) return 'In progress';
    return left > 0 ? `In progress · ${Math.ceil(left / 60000)} min left` : 'Time is up';
}

/* ───────────── what each mode means, per test type ───────────── */

const fact = (icon, text) => {
    const Icon = icon;
    return [<Icon size={15} aria-hidden="true" />, text];
};

const MODES = {
    reading: [
        {
            id: 'mock',
            icon: <Timer size={22} />,
            name: 'Mock test',
            tagline: 'Real exam conditions',
            facts: [
                fact(AlarmClock, '60-minute countdown'),
                fact(Lock, 'The clock cannot be paused'),
                fact(CircleCheck, 'Submitted by itself when time is up'),
            ],
            cta: 'Start mock test',
        },
        {
            id: 'analyse',
            icon: <InfinityIcon size={22} />,
            name: 'Analyse mode',
            tagline: 'Work through it at your own pace',
            facts: [
                fact(Timer, 'No time limit, the clock counts up'),
                fact(Highlighter, 'Highlight and take notes as you go'),
                fact(Eraser, 'Clear all to start the test again'),
            ],
            cta: 'Start analyse mode',
        },
    ],
    listening: [
        {
            id: 'mock',
            icon: <Timer size={22} />,
            name: 'Mock test',
            tagline: 'Real exam conditions',
            facts: [
                fact(Headphones, 'The recording plays once, about 30 minutes'),
                fact(Lock, 'No pausing, no rewinding'),
                fact(CircleCheck, '2 minutes to check, then submitted by itself'),
            ],
            cta: 'Start mock test',
        },
        {
            id: 'analyse',
            icon: <InfinityIcon size={22} />,
            name: 'Analyse mode',
            tagline: 'Work through it at your own pace',
            facts: [
                fact(Pause, 'Pause whenever you like, no time limit'),
                fact(Rewind, 'Rewind or skip ahead in the recording'),
                fact(Repeat, 'Clear all to start the test again'),
            ],
            cta: 'Start analyse mode',
        },
    ],
};

/**
 * Asks how to take a reading or listening test: the mock (real exam
 * conditions) or analyse mode (practice, no time limit). Both save the
 * same result.
 *
 * type    — 'reading' | 'listening'
 * test    — { id, title }
 * newTab  — open the test in a new tab (the daily plan does) and close
 */
export default function TestModeDialog({ type, test, onClose, newTab = false }) {
    const { user } = useAuth();
    const firstRef = useRef(null);
    const closeRef = useRef(onClose);
    const [notes] = useState(() => ({
        mock: sittingNote(type, user?.uid, test.id, 'mock'),
        analyse: sittingNote(type, user?.uid, test.id, 'analyse'),
    }));
    const modes = MODES[type] || MODES.reading;
    const HeadIcon = type === 'listening' ? Headphones : BookOpen;

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
        const url = getTestUrl(type, test.id, mode);
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
                    <span className="rmode-head-icon"><HeadIcon size={20} /></span>
                    <div className="rmode-head-text">
                        <h3 id="rmode-title">{test.title}</h3>
                        <p id="rmode-desc">How would you like to take this test?</p>
                    </div>
                    <button type="button" className="rmode-close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </header>

                <div className="rmode-options">
                    {modes.map(({ id, icon, name, tagline, facts, cta }, i) => (
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
