// The student results shown in the landing page's "Our Outstanding Results"
// section: every result that is on the site, and adding, editing and
// removing them.
//
// The list mirrors what visitors see — same order, same card — so an admin
// can spot a wrong band or a duplicate at a glance and fix it in place.
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
    Award, Check, Copy, EyeOff, Globe, ImageOff, ImagePlus, Loader2,
    Pencil, Plus, RefreshCw, Search, Trash2, X,
} from 'lucide-react';
import { db, storage } from '../firebase';
import './ResultsManager.css';

// bands offered in the editor; a stored value outside this range still shows
const BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

const formatBand = (band) => {
    const n = Number(band);
    return Number.isFinite(n) ? n.toFixed(1) : '—';
};

const bandTone = (band) => {
    const n = Number(band);
    if (n >= 8) return 'top';
    if (n >= 7) return 'high';
    if (n >= 6) return 'mid';
    return 'base';
};

// createdAt is a number on most results and a Firestore Timestamp on older
// ones; the landing page sorts on it and skips results that have none.
const createdMillis = (c) => {
    if (typeof c === 'number') return c;
    if (c && typeof c.toMillis === 'function') return c.toMillis();
    if (c && typeof c.seconds === 'number') return c.seconds * 1000;
    return null;
};

// The site shows newest first by the actual date, whichever way it is stored
// (src/modules/data/data-loader.js). Results without one are not on the site,
// so they go last.
const bySiteOrder = (a, b) => (createdMillis(b.createdAt) ?? -1) - (createdMillis(a.createdAt) ?? -1);

const SORTS = {
    site: { label: 'As on the website', fn: bySiteOrder },
    band: { label: 'Highest band', fn: (a, b) => Number(b.band) - Number(a.band) || String(a.name).localeCompare(String(b.name)) },
    name: { label: 'Name A–Z', fn: (a, b) => String(a.name).localeCompare(String(b.name)) },
};

const dateLabel = (c) => {
    const ms = createdMillis(c);
    return ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
};

const dupKey = (r) => `${String(r.name || '').trim().toLowerCase().replace(/\s+/g, ' ')}|${Number(r.band)}`;

/** Removes an uploaded result photo, unless another result still shows it. */
async function removeStoredPhoto(url, stillUsedBy) {
    if (!url || stillUsedBy.some((r) => r.photoURL === url)) return;
    try {
        const fileRef = storageRef(storage, url);
        if (!fileRef.fullPath.startsWith('results/')) return;
        await deleteObject(fileRef);
    } catch {
        // not one of ours, already gone, or not allowed: the result itself is
        // what matters, a stray file costs nothing visible
    }
}

async function uploadPhoto(file) {
    const fileRef = storageRef(storage, `results/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
}

/* ─────────────────────────── the list ─────────────────────────── */

export default function ResultsManager({ results, loading, error, reload, groups = [], notify }) {
    const [queryText, setQueryText] = useState('');
    const [sort, setSort] = useState('site');
    const [editing, setEditing] = useState(null);   // { mode: 'add' } | { mode: 'edit', result }
    const [removing, setRemoving] = useState(null); // the result to delete
    const openerRef = useRef(null);

    const duplicates = useMemo(() => {
        const seen = new Map();
        (results || []).forEach((r) => seen.set(dupKey(r), (seen.get(dupKey(r)) || 0) + 1));
        return seen;
    }, [results]);

    const shown = useMemo(() => {
        const q = queryText.trim().toLowerCase();
        const list = (results || []).filter((r) =>
            !q || String(r.name || '').toLowerCase().includes(q) || String(r.group || '').toLowerCase().includes(q)
        );
        return [...list].sort(SORTS[sort].fn);
    }, [results, queryText, sort]);

    const groupSuggestions = useMemo(() => {
        const names = new Set();
        (results || []).forEach((r) => r.group && names.add(String(r.group).trim()));
        groups.forEach((g) => g.name && names.add(String(g.name).trim()));
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [results, groups]);

    const onSite = (results || []).filter((r) => r.createdAt != null).length;

    const open = (state, e) => {
        openerRef.current = e?.currentTarget || null;
        setEditing(state);
    };
    const close = () => {
        setEditing(null);
        setRemoving(null);
        openerRef.current?.focus?.();
    };

    return (
        <div className="rm">
            <div className="rm-head">
                <div className="rm-title">
                    <h3><Award size={20} /> Results on the website</h3>
                    <p>
                        {loading ? 'Loading…' : `${onSite} shown on the landing page`}
                        <span className="rm-dot" aria-hidden="true">·</span>
                        Visitors see changes on their next visit, within 30 minutes.
                    </p>
                </div>
                <button type="button" className="rm-btn primary" onClick={(e) => open({ mode: 'add' }, e)}>
                    <Plus size={18} /> Add result
                </button>
            </div>

            <div className="rm-toolbar">
                <label className="rm-search">
                    <Search size={17} aria-hidden="true" />
                    <input
                        type="search"
                        placeholder="Search by name or group"
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        aria-label="Search results"
                    />
                </label>
                <div className="rm-sort" role="group" aria-label="Sort results">
                    {Object.entries(SORTS).map(([key, { label }]) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={sort === key}
                            className={sort === key ? 'active' : ''}
                            onClick={() => setSort(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {error ? (
                <div className="rm-state">
                    <p>The results could not be loaded. {error}</p>
                    <button type="button" className="rm-btn" onClick={reload}><RefreshCw size={16} /> Try again</button>
                </div>
            ) : loading ? (
                <div className="rm-grid" aria-busy="true">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="rm-card rm-card--skeleton">
                            <div className="rm-photo" />
                            <div className="rm-body"><span /><span /></div>
                        </div>
                    ))}
                </div>
            ) : !results.length ? (
                <div className="rm-state rm-empty">
                    <div className="rm-empty-icon"><Award size={30} /></div>
                    <h4>No results on the website yet</h4>
                    <p>Add a student's IELTS result with their photo or certificate — it appears in the “Our Outstanding Results” section.</p>
                    <button type="button" className="rm-btn primary" onClick={(e) => open({ mode: 'add' }, e)}>
                        <Plus size={18} /> Add the first result
                    </button>
                </div>
            ) : !shown.length ? (
                <div className="rm-state"><p>Nothing matches “{queryText}”.</p></div>
            ) : (
                <div className="rm-grid">
                    {shown.map((r) => {
                        const dup = (duplicates.get(dupKey(r)) || 0) > 1;
                        const hidden = r.createdAt == null;
                        const added = dateLabel(r.createdAt);
                        return (
                            <article key={r.id} className="rm-card">
                                <div className="rm-photo">
                                    <ResultPhoto url={r.photoURL} name={r.name} />
                                    <span className={`rm-band tone-${bandTone(r.band)}`} title="IELTS band">{formatBand(r.band)}</span>
                                    {(dup || hidden) && (
                                        <div className="rm-flags">
                                            {dup && <span className="rm-flag warn" title="Same name and band as another result"><Copy size={12} /> Possible duplicate</span>}
                                            {hidden && <span className="rm-flag muted" title="The website skips results without a date; saving it adds one"><EyeOff size={12} /> Not on the website</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="rm-body">
                                    <h4 className="rm-name">{r.name || 'Unnamed'}</h4>
                                    <p className="rm-meta">
                                        <span className="rm-group">{r.group || 'No group'}</span>
                                        {added && <><span className="rm-dot" aria-hidden="true">·</span><span>{added}</span></>}
                                    </p>
                                </div>
                                <div className="rm-actions">
                                    <button type="button" className="rm-btn ghost" onClick={(e) => open({ mode: 'edit', result: r }, e)} aria-label={`Edit ${r.name}`}>
                                        <Pencil size={15} /> Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="rm-icon danger"
                                        onClick={(e) => { openerRef.current = e.currentTarget; setRemoving(r); }}
                                        aria-label={`Delete ${r.name}`}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {editing && (
                <ResultEditor
                    key={editing.result?.id || 'new'}
                    result={editing.mode === 'edit' ? editing.result : null}
                    all={results || []}
                    groupSuggestions={groupSuggestions}
                    onClose={close}
                    onSaved={async (msg) => { close(); notify(msg); await reload(); }}
                    onError={(msg) => notify(msg, 'error')}
                />
            )}

            {removing && (
                <DeleteDialog
                    result={removing}
                    all={results || []}
                    onClose={close}
                    onDeleted={async (msg) => { close(); notify(msg); await reload(); }}
                    onError={(msg) => notify(msg, 'error')}
                />
            )}
        </div>
    );
}

/** The result's photo; a missing or broken one is shown as such, so it can be fixed. */
function ResultPhoto({ url, name }) {
    const [failedUrl, setFailedUrl] = useState(null);
    if (!url || failedUrl === url) {
        return (
            <span className="rm-nophoto">
                <ImageOff size={26} />
                {url ? 'Photo did not load' : 'No photo'}
            </span>
        );
    }
    return <img src={url} alt={name || 'Student result'} loading="lazy" onError={() => setFailedUrl(url)} />;
}

/* ─────────────────────────── shared dialog shell ─────────────────────────── */

function Dialog({ title, labelId, onClose, busy, children, className = '' }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose, busy]);

    return (
        <div className="rm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className={`rm-dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelId}>
                <header className="rm-dialog-head">
                    <h3 id={labelId}>{title}</h3>
                    <button type="button" className="rm-icon" onClick={onClose} disabled={busy} aria-label="Close">
                        <X size={18} />
                    </button>
                </header>
                {children}
            </div>
        </div>
    );
}

/* ─────────────────────────── add / edit ─────────────────────────── */

function ResultEditor({ result, all, groupSuggestions, onClose, onSaved, onError }) {
    const isEdit = !!result;
    const [name, setName] = useState(result?.name || '');
    const [band, setBand] = useState(result?.band != null ? Number(result.band) : null);
    const [group, setGroup] = useState(result?.group || '');
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');   // idle | uploading | saving
    const [tried, setTried] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileInput = useRef(null);
    const nameInput = useRef(null);
    const busy = status !== 'idle';

    useEffect(() => { nameInput.current?.focus(); }, []);

    // a chosen file is previewed from memory; let go of it when replaced
    const fileURL = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => { if (fileURL) URL.revokeObjectURL(fileURL); }, [fileURL]);
    const preview = fileURL || result?.photoURL || '';

    const bands = useMemo(
        () => (band != null && !BANDS.includes(band) ? [...BANDS, band].sort((a, b) => a - b) : BANDS),
        [band]
    );

    const errors = {
        photo: !isEdit && !file ? 'Add a photo or certificate.' : null,
        name: !name.trim() ? 'Enter the student’s name.' : null,
        band: band == null ? 'Choose the band.' : null,
        group: !group.trim() ? 'Enter the group.' : null,
    };
    const valid = !Object.values(errors).some(Boolean);
    const show = (k) => tried && errors[k];

    const pick = (f) => {
        if (!f) return;
        if (!f.type.startsWith('image/')) { onError('❌ That file is not an image.'); return; }
        setFile(f);
    };

    const submit = async (e) => {
        e.preventDefault();
        setTried(true);
        if (!valid || busy) return;
        try {
            let photoURL = result?.photoURL || '';
            if (file) {
                setStatus('uploading');
                photoURL = await uploadPhoto(file);
            }
            setStatus('saving');
            const data = { name: name.trim(), band: Number(band), group: group.trim(), photoURL };
            if (isEdit) {
                const patch = { ...data, updatedAt: Date.now() };
                // the site skips results without a date; saving puts it back
                if (result.createdAt == null) patch.createdAt = Date.now();
                await updateDoc(doc(db, 'results', result.id), patch);
                if (file && result.photoURL) {
                    await removeStoredPhoto(result.photoURL, all.filter((r) => r.id !== result.id));
                }
                await onSaved(`✅ ${data.name} updated`);
            } else {
                await addDoc(collection(db, 'results'), { ...data, createdAt: Date.now() });
                await onSaved(`✅ ${data.name} added to the website`);
            }
        } catch (err) {
            setStatus('idle');
            onError(`❌ ${err.message}`);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
    };

    return (
        <Dialog
            title={isEdit ? 'Edit result' : 'Add a result'}
            labelId="rm-editor-title"
            onClose={onClose}
            busy={busy}
            className="rm-dialog--editor"
        >
            <form className="rm-editor" onSubmit={submit} noValidate>
                <div className="rm-editor-body">
                    <div className="rm-fields">
                        <div className="rm-field">
                            <span className="rm-label">Photo or certificate</span>
                            <div
                                className={`rm-drop ${dragging ? 'dragging' : ''} ${preview ? 'has-photo' : ''} ${show('photo') ? 'invalid' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                            >
                                {preview ? (
                                    <>
                                        <img src={preview} alt="" />
                                        <button type="button" className="rm-btn small" onClick={() => fileInput.current?.click()} disabled={busy}>
                                            <ImagePlus size={15} /> {isEdit || file ? 'Replace photo' : 'Choose photo'}
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" className="rm-drop-empty" onClick={() => fileInput.current?.click()} disabled={busy}>
                                        <ImagePlus size={28} />
                                        <strong>Drop a photo here, or click to choose</strong>
                                        <span>JPG, PNG or WebP. Certificates stay readable: nothing is cropped.</span>
                                    </button>
                                )}
                                <input
                                    ref={fileInput}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
                                />
                            </div>
                            {show('photo') && <span className="rm-error">{errors.photo}</span>}
                        </div>

                        <label className="rm-field">
                            <span className="rm-label">Student name</span>
                            <input
                                ref={nameInput}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Xaydarova Kamila"
                                maxLength={60}
                                disabled={busy}
                                aria-invalid={!!show('name')}
                            />
                            {show('name') && <span className="rm-error">{errors.name}</span>}
                        </label>

                        <div className="rm-field">
                            <span className="rm-label" id="rm-band-label">IELTS band</span>
                            <div className="rm-bands" role="group" aria-labelledby="rm-band-label">
                                {bands.map((b) => (
                                    <button
                                        key={b}
                                        type="button"
                                        aria-pressed={band === b}
                                        className={`rm-band-chip tone-${bandTone(b)} ${band === b ? 'active' : ''}`}
                                        onClick={() => setBand(b)}
                                        disabled={busy}
                                    >
                                        {formatBand(b)}
                                    </button>
                                ))}
                            </div>
                            {show('band') && <span className="rm-error">{errors.band}</span>}
                        </div>

                        <label className="rm-field">
                            <span className="rm-label">Group</span>
                            <input
                                value={group}
                                onChange={(e) => setGroup(e.target.value)}
                                placeholder="e.g. IELTS"
                                list="rm-group-options"
                                maxLength={40}
                                disabled={busy}
                                aria-invalid={!!show('group')}
                            />
                            <datalist id="rm-group-options">
                                {groupSuggestions.map((g) => <option key={g} value={g} />)}
                            </datalist>
                            {show('group') && <span className="rm-error">{errors.group}</span>}
                        </label>
                    </div>

                    <aside className="rm-preview" aria-label="Preview on the website">
                        <span className="rm-preview-label"><Globe size={14} /> On the website</span>
                        {/* the card as the landing page's results strip draws it */}
                        <div className="rm-site-card">
                            <div className="rm-site-photo">
                                {preview ? <img src={preview} alt="" /> : <ImagePlus size={30} />}
                                <span className="rm-site-band"><small>IELTS</small>{band != null ? formatBand(band) : '—'}</span>
                            </div>
                            <h3>{name.trim() || 'Student name'}</h3>
                            <p>Group: {group.trim() || '—'}</p>
                        </div>
                    </aside>
                </div>

                <footer className="rm-dialog-foot">
                    <span className="rm-status" aria-live="polite">
                        {status === 'uploading' && <><Loader2 size={15} className="rm-spin" /> Uploading the photo…</>}
                        {status === 'saving' && <><Loader2 size={15} className="rm-spin" /> Saving…</>}
                    </span>
                    <button type="button" className="rm-btn" onClick={onClose} disabled={busy}>Cancel</button>
                    <button type="submit" className="rm-btn primary" disabled={busy}>
                        {busy ? <Loader2 size={16} className="rm-spin" /> : <Check size={16} />}
                        {isEdit ? 'Save changes' : 'Add to the website'}
                    </button>
                </footer>
            </form>
        </Dialog>
    );
}

/* ─────────────────────────── delete ─────────────────────────── */

function DeleteDialog({ result, all, onClose, onDeleted, onError }) {
    const [busy, setBusy] = useState(false);
    const cancelRef = useRef(null);
    useEffect(() => { cancelRef.current?.focus(); }, []);

    const confirmDelete = async () => {
        setBusy(true);
        try {
            await deleteDoc(doc(db, 'results', result.id));
            await removeStoredPhoto(result.photoURL, all.filter((r) => r.id !== result.id));
            await onDeleted(`🗑️ ${result.name} removed from the website`);
        } catch (err) {
            setBusy(false);
            onError(`❌ ${err.message}`);
        }
    };

    return (
        <Dialog title="Remove this result?" labelId="rm-delete-title" onClose={onClose} busy={busy} className="rm-dialog--confirm">
            <div className="rm-confirm">
                <div className="rm-confirm-who">
                    {result.photoURL ? <img src={result.photoURL} alt="" /> : <span className="rm-confirm-nophoto"><ImageOff size={20} /></span>}
                    <div>
                        <strong>{result.name}</strong>
                        <span>Band {formatBand(result.band)} · {result.group || 'No group'}</span>
                    </div>
                </div>
                <p>It disappears from the landing page, and its photo is deleted. This cannot be undone.</p>
            </div>
            <footer className="rm-dialog-foot">
                <span />
                <button ref={cancelRef} type="button" className="rm-btn" onClick={onClose} disabled={busy}>Keep it</button>
                <button type="button" className="rm-btn danger" onClick={confirmDelete} disabled={busy}>
                    {busy ? <Loader2 size={16} className="rm-spin" /> : <Trash2 size={16} />} Delete
                </button>
            </footer>
        </Dialog>
    );
}
