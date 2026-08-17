import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlashcardSets, deleteSet } from '../hooks/useFlashcards';
import { Layers, Plus, Globe, User, Play, Pencil, Trash2, Sparkles } from 'lucide-react';
import './Flashcards.css';

function SetCard({ set, canManage, onDeleted }) {
    const navigate = useNavigate();
    const count = set.cards?.length || 0;

    const handleDelete = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Delete "${set.title}" and its ${count} card${count === 1 ? '' : 's'}?`)) return;
        try {
            await deleteSet(set.id);
            onDeleted(set.id);
        } catch (err) {
            alert('Could not delete this set: ' + err.message);
        }
    };

    return (
        <Link to={`/flashcards/${set.id}`} className="fc-set-card">
            <div className="fc-set-top">
                <span className={`fc-scope ${set.scope}`}>
                    {set.scope === 'shared' ? <><Globe size={13} /> Shared</> : <><User size={13} /> Mine</>}
                </span>
                <span className="fc-count">{count} card{count === 1 ? '' : 's'}</span>
            </div>

            <h4>{set.title}</h4>
            {set.description && <p className="fc-set-desc">{set.description}</p>}

            {/* first few terms, so a set is recognisable without opening it */}
            <div className="fc-preview">
                {(set.cards || []).slice(0, 3).map((c, i) => (
                    <span key={i} className="fc-chip">{c.term}</span>
                ))}
                {count > 3 && <span className="fc-chip more">+{count - 3}</span>}
            </div>

            <div className="fc-set-actions">
                <span className="fc-btn study"><Play size={15} /> Study</span>
                {canManage && (
                    <>
                        <button
                            className="fc-icon-btn"
                            title="Edit"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/flashcards/${set.id}/edit`); }}
                        >
                            <Pencil size={15} />
                        </button>
                        <button className="fc-icon-btn danger" title="Delete" onClick={handleDelete}>
                            <Trash2 size={15} />
                        </button>
                    </>
                )}
            </div>
        </Link>
    );
}

export default function Flashcards() {
    const { user, isAdmin } = useAuth();
    const { shared, mine, loading } = useFlashcardSets(user?.uid);
    const [removed, setRemoved] = useState([]);

    const visible = (list) => list.filter((s) => !removed.includes(s.id));
    const onDeleted = (id) => setRemoved((prev) => [...prev, id]);

    const sharedSets = visible(shared);
    const mySets = visible(mine);

    return (
        <div className="flashcards-page page-enter">
            <div className="fc-header">
                <div>
                    <h2><Layers size={24} /> Flashcards</h2>
                    <p>Flip through vocabulary, swipe what you know away.</p>
                </div>
                <div className="fc-header-actions">
                    <Link to="/flashcards/new" className="fc-new-btn">
                        <Plus size={18} /> New set
                    </Link>
                    {isAdmin && (
                        <Link to="/flashcards/new?scope=shared" className="fc-new-btn shared">
                            <Sparkles size={18} /> New set for everyone
                        </Link>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="fc-loading">Loading your sets…</div>
            ) : (
                <>
                    <section className="fc-section">
                        <h3><Globe size={18} /> Shared by YES</h3>
                        {sharedSets.length === 0 ? (
                            <p className="fc-empty">No shared sets yet.</p>
                        ) : (
                            <div className="fc-grid">
                                {sharedSets.map((s) => (
                                    <SetCard key={s.id} set={s} canManage={isAdmin} onDeleted={onDeleted} />
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="fc-section">
                        <h3><User size={18} /> My sets</h3>
                        {mySets.length === 0 ? (
                            <div className="fc-empty-card">
                                <Layers size={40} strokeWidth={1.5} />
                                <p>You haven't made a set yet.</p>
                                <Link to="/flashcards/new" className="fc-new-btn">
                                    <Plus size={18} /> Create your first set
                                </Link>
                            </div>
                        ) : (
                            <div className="fc-grid">
                                {mySets.map((s) => (
                                    <SetCard key={s.id} set={s} canManage onDeleted={onDeleted} />
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}
