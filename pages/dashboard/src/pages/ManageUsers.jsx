import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref as storageRef, getStorage, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    Users, UserPlus, Trash2, Layers, Award, MessageSquare,
    ChevronDown, ChevronUp, ArrowLeft, Search, Plus, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ManageUsersSkeleton } from '../components/Skeleton';
import './ManageUsers.css';

const storage = getStorage();

export default function ManageUsers() {
    const { isAdmin } = useAuth();
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showAddResult, setShowAddResult] = useState(false);
    const [showAddFeedback, setShowAddFeedback] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // Forms state
    const [newUser, setNewUser] = useState({ email: '', password: '', name: '', username: '', role: 'student' });
    const [newGroup, setNewGroup] = useState({ name: '', photo: null });
    const [newResult, setNewResult] = useState({ name: '', band: '', group: '', photo: null });
    const [newFeedback, setNewFeedback] = useState({ name: '', group: '', feedback: '' });

    const loadUsers = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, 'users'));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading users:', err);
        }
    }, []);

    const loadGroups = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, 'groups'));
            setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('Error loading groups:', err);
        }
    }, []);

    useEffect(() => {
        Promise.all([loadUsers(), loadGroups()]).finally(() => setLoading(false));
    }, [loadUsers, loadGroups]);

    const showMsg = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch('https://us-central1-yes-english-center.cloudfunctions.net/createUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(newUser),
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showMsg(`✅ User created (UID: ${result.uid})`);
            setNewUser({ email: '', password: '', name: '', username: '', role: 'student' });
            setShowCreateUser(false);
            await loadUsers();
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    const handleDeleteUser = async (uid) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch('https://us-central1-yes-english-center.cloudfunctions.net/deleteUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ uid }),
            });
            if (!res.ok) throw new Error(await res.text());
            showMsg('✅ User deleted');
            await loadUsers();
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    const handleAddGroup = async (e) => {
        e.preventDefault();
        if (!newGroup.photo || !newGroup.name) return showMsg('❌ Fill all fields', 'error');
        try {
            const fileRef = storageRef(storage, `groups/${Date.now()}_${newGroup.photo.name}`);
            await uploadBytes(fileRef, newGroup.photo);
            const photoURL = await getDownloadURL(fileRef);
            await addDoc(collection(db, 'groups'), { name: newGroup.name, photoURL, createdAt: Date.now() });
            showMsg('✅ Group added');
            setNewGroup({ name: '', photo: null });
            setShowAddGroup(false);
            await loadGroups();
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    const handleDeleteGroup = async (id) => {
        if (!confirm('Delete this group?')) return;
        try {
            await deleteDoc(doc(db, 'groups', id));
            showMsg('✅ Group deleted');
            await loadGroups();
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    const handleAddResult = async (e) => {
        e.preventDefault();
        if (!newResult.photo || !newResult.name || !newResult.band || !newResult.group) return showMsg('❌ Fill all fields', 'error');
        try {
            const fileRef = storageRef(storage, `results/${Date.now()}_${newResult.photo.name}`);
            await uploadBytes(fileRef, newResult.photo);
            const photoURL = await getDownloadURL(fileRef);
            await addDoc(collection(db, 'results'), {
                name: newResult.name, band: parseFloat(newResult.band),
                group: newResult.group, photoURL, createdAt: Date.now(),
            });
            showMsg('✅ Result added');
            setNewResult({ name: '', band: '', group: '', photo: null });
            setShowAddResult(false);
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    const handleAddFeedback = async (e) => {
        e.preventDefault();
        if (!newFeedback.name || !newFeedback.group || !newFeedback.feedback) return showMsg('❌ Fill all fields', 'error');
        try {
            await addDoc(collection(db, 'feedbacks'), { ...newFeedback, createdAt: Date.now() });
            showMsg('✅ Feedback added');
            setNewFeedback({ name: '', group: '', feedback: '' });
            setShowAddFeedback(false);
        } catch (err) {
            showMsg(`❌ ${err.message}`, 'error');
        }
    };

    if (!isAdmin) return <Navigate to="/" replace />;

    const filteredUsers = users.filter(u =>
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const TABS = [
        { key: 'users', label: 'Users', icon: Users, count: users.length },
        { key: 'groups', label: 'Groups', icon: Layers, count: groups.length },
        { key: 'results', label: 'Results', icon: Award },
        { key: 'feedback', label: 'Feedback', icon: MessageSquare },
    ];

    return (
        <div className="manage-page page-enter">
            <div className="manage-header">
                <Link to="/admin" className="back-link"><ArrowLeft size={20} /> Back to Admin</Link>
                <h2><Users size={24} /> Manage Users & Data</h2>
            </div>

            {message.text && <div className={`toast ${message.type}`}>{message.text}</div>}

            <div className="manage-tabs">
                {TABS.map(({ key, label, icon: Icon, count }) => (
                    <button key={key} className={`tab-btn ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                        <Icon size={18} /> {label}{count != null ? ` (${count})` : ''}
                    </button>
                ))}
            </div>

            {loading ? (
                <ManageUsersSkeleton />
            ) : (
                <>
                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div className="tab-content">
                            <div className="tab-toolbar">
                                <div className="search-box">
                                    <Search size={18} />
                                    <input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                                <button className="action-btn primary" onClick={() => setShowCreateUser(!showCreateUser)}>
                                    {showCreateUser ? <X size={18} /> : <UserPlus size={18} />}
                                    {showCreateUser ? 'Cancel' : 'Create User'}
                                </button>
                            </div>

                            {showCreateUser && (
                                <form className="inline-form glass-card" onSubmit={handleCreateUser}>
                                    <h4><UserPlus size={18} /> Create New User</h4>
                                    <div className="form-grid">
                                        <input placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                                        <input placeholder="Username" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                                        <input type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                                        <input type="password" placeholder="Password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                                        <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                            <option value="student">Student</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <button type="submit" className="action-btn primary">Create</button>
                                </form>
                            )}

                            <div className="users-list">
                                {filteredUsers.map(u => (
                                    <div key={u.id} className="user-card glass-card">
                                        <div className="user-avatar-sm">{(u.name || u.email || 'U')[0].toUpperCase()}</div>
                                        <div className="user-details">
                                            <span className="user-name-text">{u.name || 'No name'}</span>
                                            <span className="user-email">{u.email}</span>
                                        </div>
                                        <span className={`role-badge ${u.role}`}>{u.role || 'student'}</span>
                                        <button className="delete-btn" onClick={() => handleDeleteUser(u.id)} title="Delete user">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {filteredUsers.length === 0 && <p className="empty-msg">No users found</p>}
                            </div>
                        </div>
                    )}

                    {/* Groups Tab */}
                    {activeTab === 'groups' && (
                        <div className="tab-content">
                            <div className="tab-toolbar">
                                <span />
                                <button className="action-btn primary" onClick={() => setShowAddGroup(!showAddGroup)}>
                                    {showAddGroup ? <X size={18} /> : <Plus size={18} />}
                                    {showAddGroup ? 'Cancel' : 'Add Group'}
                                </button>
                            </div>

                            {showAddGroup && (
                                <form className="inline-form glass-card" onSubmit={handleAddGroup}>
                                    <h4><Layers size={18} /> Add New Group</h4>
                                    <div className="form-grid">
                                        <input placeholder="Group Name" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} required />
                                        <input type="file" accept="image/*" onChange={e => setNewGroup({ ...newGroup, photo: e.target.files[0] })} required />
                                    </div>
                                    <button type="submit" className="action-btn primary">Add Group</button>
                                </form>
                            )}

                            <div className="groups-grid">
                                {groups.map(g => (
                                    <div key={g.id} className="group-card glass-card">
                                        <img src={g.photoURL} alt={g.name} className="group-photo" />
                                        <span className="group-name">{g.name}</span>
                                        <button className="delete-btn" onClick={() => handleDeleteGroup(g.id)} title="Delete group">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {groups.length === 0 && <p className="empty-msg">No groups yet</p>}
                            </div>
                        </div>
                    )}

                    {/* Results Tab */}
                    {activeTab === 'results' && (
                        <div className="tab-content">
                            <div className="tab-toolbar">
                                <span />
                                <button className="action-btn primary" onClick={() => setShowAddResult(!showAddResult)}>
                                    {showAddResult ? <X size={18} /> : <Plus size={18} />}
                                    {showAddResult ? 'Cancel' : 'Add Result'}
                                </button>
                            </div>

                            {showAddResult && (
                                <form className="inline-form glass-card" onSubmit={handleAddResult}>
                                    <h4><Award size={18} /> Add Student Result</h4>
                                    <div className="form-grid">
                                        <input placeholder="Student Name" value={newResult.name} onChange={e => setNewResult({ ...newResult, name: e.target.value })} required />
                                        <input type="number" step="0.5" min="0" max="9" placeholder="IELTS Band" value={newResult.band} onChange={e => setNewResult({ ...newResult, band: e.target.value })} required />
                                        <input placeholder="Group" value={newResult.group} onChange={e => setNewResult({ ...newResult, group: e.target.value })} required />
                                        <input type="file" accept="image/*" onChange={e => setNewResult({ ...newResult, photo: e.target.files[0] })} required />
                                    </div>
                                    <button type="submit" className="action-btn primary">Add Result</button>
                                </form>
                            )}

                            <p className="empty-msg">Use the form above to add student IELTS results to the landing page.</p>
                        </div>
                    )}

                    {/* Feedback Tab */}
                    {activeTab === 'feedback' && (
                        <div className="tab-content">
                            <div className="tab-toolbar">
                                <span />
                                <button className="action-btn primary" onClick={() => setShowAddFeedback(!showAddFeedback)}>
                                    {showAddFeedback ? <X size={18} /> : <Plus size={18} />}
                                    {showAddFeedback ? 'Cancel' : 'Add Feedback'}
                                </button>
                            </div>

                            {showAddFeedback && (
                                <form className="inline-form glass-card" onSubmit={handleAddFeedback}>
                                    <h4><MessageSquare size={18} /> Add Student Feedback</h4>
                                    <div className="form-grid">
                                        <input placeholder="Student Name" value={newFeedback.name} onChange={e => setNewFeedback({ ...newFeedback, name: e.target.value })} required />
                                        <input placeholder="Group" value={newFeedback.group} onChange={e => setNewFeedback({ ...newFeedback, group: e.target.value })} required />
                                        <textarea placeholder="Feedback text..." value={newFeedback.feedback} onChange={e => setNewFeedback({ ...newFeedback, feedback: e.target.value })} required rows={3} />
                                    </div>
                                    <button type="submit" className="action-btn primary">Add Feedback</button>
                                </form>
                            )}

                            <p className="empty-msg">Use the form above to add student feedback to the landing page.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
