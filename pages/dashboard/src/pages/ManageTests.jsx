import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ArrowLeft, Trash2, Edit3, ExternalLink, BookOpen, Headphones, PenTool, Search } from 'lucide-react';
import { ManageTestsSkeleton } from '../components/Skeleton';
import './ManageTests.css';

const TYPE_CONFIG = {
    listening: { label: 'Listening', icon: Headphones, collection: 'listeningTests', color: '#8b5cf6', editPath: '/settings/admin/tests/edit/listening/editListening/' },
    reading: { label: 'Reading', icon: BookOpen, collection: 'readingTests', color: '#3b82f6', editPath: '/settings/admin/tests/edit/reading/editReading/' },
    writing: { label: 'Writing', icon: PenTool, collection: 'writingTests', color: '#10b981', editPath: '/settings/admin/tests/edit/writing/editWriting/' },
};

export default function ManageTests() {
    const { isAdmin } = useAuth();
    const { type } = useParams();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModal, setDeleteModal] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const config = TYPE_CONFIG[type] || TYPE_CONFIG.listening;
    const Icon = config.icon;

    const loadTests = useCallback(async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, config.collection));
            setTests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading tests:', err);
        } finally {
            setLoading(false);
        }
    }, [config.collection]);

    useEffect(() => {
        loadTests();
    }, [loadTests]);

    const handleDelete = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, config.collection, deleteModal.id));
            setTests(prev => prev.filter(t => t.id !== deleteModal.id));
            setDeleteModal(null);
        } catch (err) {
            alert('Error deleting test: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    if (!isAdmin) return <Navigate to="/" replace />;

    const getTestName = (t) => t.title || t.name || `${config.label} Test ${t.id.replace('test-', '')}`;

    const filteredTests = tests.filter(t =>
        getTestName(t).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="manage-tests-page page-enter">
            <div className="manage-header">
                <Link to="/admin" className="back-link"><ArrowLeft size={20} /> Back to Admin</Link>
                <h2 style={{ color: config.color }}>
                    <Icon size={24} /> Manage {config.label} Tests
                </h2>
                <p className="test-count">{tests.length} test{tests.length !== 1 ? 's' : ''} found</p>
            </div>

            <div className="mt-toolbar">
                <div className="search-box">
                    <Search size={18} />
                    <input placeholder={`Search ${config.label.toLowerCase()} tests...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <a href={`/settings/admin/tests/add/${type}/index.html`} className="action-btn primary">
                    + Add New Test
                </a>
            </div>

            {loading ? (
                <ManageTestsSkeleton />
            ) : filteredTests.length === 0 ? (
                <div className="empty-state-mt">
                    <Icon size={48} strokeWidth={1.5} />
                    <h3>No {config.label} Tests</h3>
                    <p>No tests found. Create one to get started.</p>
                    <a href={`/settings/admin/tests/add/${type}/index.html`} className="action-btn primary" style={{ marginTop: '0.75rem' }}>
                        + Add First Test
                    </a>
                </div>
            ) : (
                <div className="tests-grid-mt">
                    {filteredTests.map(test => (
                        <div key={test.id} className="test-card-mt glass-card">
                            <div className="test-card-header" style={{ borderLeftColor: config.color }}>
                                <div className="test-icon-sm" style={{ background: config.color }}>
                                    <Icon size={18} color="#fff" />
                                </div>
                                <div className="test-info">
                                    <h4>{test.title || test.name || `${config.label} Test ${test.id.replace('test-', '')}`}</h4>
                                    {test.description && <p className="test-desc">{test.description}</p>}
                                </div>
                            </div>
                            <div className="test-meta">
                                {test.questions && <span className="meta-tag">{Array.isArray(test.questions) ? test.questions.length : Object.keys(test.questions).length} questions</span>}
                                {test.passages && <span className="meta-tag">{Array.isArray(test.passages) ? test.passages.length : Object.keys(test.passages).length} passages</span>}
                                {test.duration && <span className="meta-tag">{test.duration} min</span>}
                            </div>
                            <div className="test-card-actions">
                                <button className="tc-btn edit" title="Edit" onClick={() => window.location.assign(`${config.editPath}?testId=${test.id}`)}>
                                    <Edit3 size={16} /> Edit
                                </button>
                                <button className="tc-btn delete" onClick={() => setDeleteModal(test)} title="Delete">
                                    <Trash2 size={16} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Modal */}
            {deleteModal && (
                <div className="modal-overlay" onClick={() => !deleting && setDeleteModal(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>⚠️ Delete Test</h3>
                        <p>Are you sure you want to delete <strong>{getTestName(deleteModal)}</strong>?</p>
                        <p className="modal-warning">This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setDeleteModal(null)} disabled={deleting}>Cancel</button>
                            <button className="modal-btn confirm" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
