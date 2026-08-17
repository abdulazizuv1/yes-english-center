import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlashcardSet, createSet, saveSet, cleanCards } from '../hooks/useFlashcards';
import { ArrowLeft, Plus, Trash2, Save, Globe, User } from 'lucide-react';
import './EditSet.css';

const blankCard = () => ({ term: '', definition: '', example: '' });

export default function EditSet() {
    const { setId } = useParams();          // absent when creating
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const { set, loading, error } = useFlashcardSet(setId);

    const isNew = !setId;
    // admins reach the shared editor through "New set for everyone"
    const scope = isNew
        ? (params.get('scope') === 'shared' && isAdmin ? 'shared' : 'personal')
        : (set?.scope || 'personal');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [cards, setCards] = useState([blankCard(), blankCard(), blankCard()]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!set) return;
        setTitle(set.title || '');
        setDescription(set.description || '');
        setCards(set.cards?.length ? set.cards.map((c) => ({ ...c })) : [blankCard()]);
    }, [set]);

    const updateCard = (i, field, value) => {
        setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
    };

    const addCard = () => setCards((prev) => [...prev, blankCard()]);
    const removeCard = (i) => setCards((prev) => prev.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        if (!title.trim()) { alert('Give the set a title.'); return; }
        const ready = cleanCards(cards);
        if (!ready.length) { alert('Add at least one card with a term and a meaning.'); return; }

        setSaving(true);
        try {
            if (isNew) {
                const newId = await createSet({ title, description, cards, scope, user });
                navigate(`/flashcards/${newId}`);
            } else {
                await saveSet(setId, { title, description, cards });
                navigate(`/flashcards/${setId}`);
            }
        } catch (err) {
            console.error('Failed to save set:', err);
            alert('Could not save this set: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isNew && loading) {
        return <div className="editset-page page-enter"><div className="fc-loading">Loading set…</div></div>;
    }
    if (!isNew && error) {
        return (
            <div className="editset-page page-enter">
                <Link to="/flashcards" className="fc-back"><ArrowLeft size={18} /> Back</Link>
                <div className="fc-empty-card"><p>{error}</p></div>
            </div>
        );
    }

    const readyCount = cleanCards(cards).length;

    return (
        <div className="editset-page page-enter">
            <div className="editset-top">
                <Link to="/flashcards" className="fc-back"><ArrowLeft size={18} /> All sets</Link>
                <span className={`fc-scope ${scope}`}>
                    {scope === 'shared'
                        ? <><Globe size={13} /> Shared with everyone</>
                        : <><User size={13} /> Only you can see this</>}
                </span>
            </div>

            <h2>{isNew ? 'New flashcard set' : 'Edit set'}</h2>

            <div className="editset-meta">
                <label>Title</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. IELTS Speaking — Leisure Time"
                />
                <label>Description <span className="optional">(optional)</span></label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Part 3 phrases for talking about hobbies"
                />
            </div>

            <div className="editset-cards">
                <div className="editset-cards-head">
                    <h3>Cards</h3>
                    <span className="editset-ready">{readyCount} ready to study</span>
                </div>

                {cards.map((c, i) => (
                    <div className="editset-row" key={i}>
                        <span className="editset-num">{i + 1}</span>
                        <div className="editset-fields">
                            <input
                                type="text"
                                value={c.term}
                                onChange={(e) => updateCard(i, 'term', e.target.value)}
                                placeholder="Term — the word or phrase"
                            />
                            <input
                                type="text"
                                value={c.definition}
                                onChange={(e) => updateCard(i, 'definition', e.target.value)}
                                placeholder="Meaning"
                            />
                            <input
                                type="text"
                                value={c.example}
                                onChange={(e) => updateCard(i, 'example', e.target.value)}
                                placeholder="Example sentence (optional)"
                            />
                        </div>
                        <button
                            className="fc-icon-btn danger"
                            title="Remove card"
                            onClick={() => removeCard(i)}
                            disabled={cards.length === 1}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                ))}

                <button className="editset-add" onClick={addCard}>
                    <Plus size={16} /> Add card
                </button>
            </div>

            <div className="editset-actions">
                <Link to="/flashcards" className="fc-btn">Cancel</Link>
                <button className="fc-btn primary" onClick={handleSave} disabled={saving}>
                    <Save size={16} /> {saving ? 'Saving…' : isNew ? 'Create set' : 'Save changes'}
                </button>
            </div>
        </div>
    );
}
