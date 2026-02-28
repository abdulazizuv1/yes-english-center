import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, AlertCircle, TrendingUp, Lightbulb, CheckCircle2, AlertTriangle, MessageCircle, Send } from 'lucide-react';
import './Feedback.css';

export default function Feedback() {
    const { user, userData } = useAuth();

    const [category, setCategory] = useState('Report an error');
    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('idle'); // idle, sending, success, error

    const categories = [
        { id: 'Report an error', icon: AlertTriangle, label: 'Report an error' },
        { id: 'Feature request', icon: Lightbulb, label: 'Feature request' },
        { id: 'Improvement', icon: TrendingUp, label: 'Improvement' },
        { id: 'General feedback', icon: MessageCircle, label: 'General feedback' }
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!subject.trim() || message.trim().length < 10) {
            return;
        }

        setStatus('sending');

        const botToken = '8614804182:AAEL5prKYyCY3D02FWqtlWVASaFjev-qeRg';
        const chatId = '1351499476';

        const name = userData?.name || 'User';
        const email = userData?.email || user?.email || 'N/A';

        const text = `
📩 *New Feedback Received*
        
👤 *User:* ${name}
📧 *Email:* ${email}
        
📌 *Category:* ${category}
⚠️ *Priority:* ${priority}
📝 *Subject:* ${subject}
        
💬 *Message:*
${message}
        `;

        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });

            if (response.ok) {
                setStatus('success');
                setSubject('');
                setMessage('');
                setPriority('Medium');
                setCategory('Report an error');

                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error) {
            console.error('Error sending feedback:', error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div className="feedback-page page-enter">
            <div className="feedback-header">
                <div className="feedback-icon-wrapper">
                    <MessageSquare size={24} className="feedback-header-icon" />
                </div>
                <h1>Feedback</h1>
                <p>Help us improve YES English Center! Your opinion is very important to us.</p>
            </div>

            <div className="feedback-layout">
                <div className="feedback-main">
                    <div className="glass-card feedback-form-card">
                        <h2>Send Feedback</h2>

                        <form onSubmit={handleSubmit} className="feedback-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Name</label>
                                    <input type="text" value={userData?.name || 'User'} readOnly className="readonly-input" />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={userData?.email || user?.email || ''} readOnly className="readonly-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Category <span className="required">*</span></label>
                                <div className="category-grid">
                                    {categories.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`category-btn ${category === c.id ? 'active' : ''}`}
                                            onClick={() => setCategory(c.id)}
                                        >
                                            <c.icon size={16} />
                                            <span>{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Subject <span className="required">*</span> <span className="char-count">({subject.length}/3 min)</span></label>
                                <input
                                    type="text"
                                    placeholder="Briefly describe the essence of your request (minimum 3 characters)"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    required
                                    minLength={3}
                                />
                            </div>

                            <div className="form-group">
                                <label>Priority</label>
                                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Message <span className="required">*</span> <span className="char-count">({message.length}/10 min)</span></label>
                                <textarea
                                    placeholder="Briefly describe your feedback, suggestion or problem... (minimum 10 characters)"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                    minLength={10}
                                    rows={5}
                                />
                            </div>

                            <div className="form-actions">
                                {status === 'success' && <div className="status-message success">Feedback sent successfully!</div>}
                                {status === 'error' && <div className="status-message error">Failed to send. Please try again.</div>}

                                <button
                                    type="submit"
                                    className="submit-btn"
                                    disabled={status === 'sending' || subject.length < 3 || message.length < 10}
                                >
                                    <Send size={18} />
                                    <span>{status === 'sending' ? 'Sending...' : 'Send Feedback'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="feedback-sidebar">
                    <div className="glass-card info-card">
                        <h3>Contact Information</h3>

                        <div className="contact-item">
                            <div className="contact-icon">✉️</div>
                            <div>
                                <span className="contact-label">Email</span>
                                <a href="mailto:abdulazizvaliev5075@gmail.com" className="contact-value highlight">abdulazizvaliev5075@gmail.com</a>
                            </div>
                        </div>

                        <div className="contact-item">
                            <div className="contact-icon">⏱️</div>
                            <div>
                                <span className="contact-label">Response time</span>
                                <span className="contact-value">Typically within 24 hours</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card faq-card">
                        <h3>FAQ</h3>

                        <div className="faq-item">
                            <h4>How quickly do you respond?</h4>
                            <p>We try to respond to all inquiries within 24 hours on working days.</p>
                        </div>

                        <div className="faq-item">
                            <h4>When will I receive bonus attempts?</h4>
                            <p>Bonus attempts are granted within 2-3 working days after your suggestion is reviewed.</p>
                        </div>

                        <div className="faq-item">
                            <h4>What are considered useful suggestions?</h4>
                            <p>Suggestions for improving functionality, fixing errors, or new platform features.</p>
                        </div>
                    </div>

                    <div className="glass-card tips-card">
                        <h3>Tips for a better review</h3>
                        <ul>
                            <li>Be specific in describing the problem</li>
                            <li>Attach screenshots if possible (via email)</li>
                            <li>Specify the device on which the problem occurred</li>
                            <li>Offer possible solutions</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
