import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTests, getUserTestResult, convertToIELTS, getBandClass, formatType, getTypeIcon, getTestUrl, getResultUrl } from '../hooks/useResults';
import { ArrowRight } from 'lucide-react';
import { TestListSkeleton } from '../components/Skeleton';
import './TestSection.css';

const TYPE_MAP = {
    listening: { title: 'Listening Tests', desc: 'Improve your listening skills with real IELTS audio materials', time: '30 minutes • 40 questions' },
    reading: { title: 'Reading Tests', desc: 'Practice with authentic IELTS reading passages', time: '60 minutes • 40 questions' },
    writing: { title: 'Writing Tests', desc: 'Practice Task 1 and Task 2 writing skills', time: '60 minutes • 2 tasks' },
    fullmock: { title: 'Full Mock Tests', desc: 'Complete IELTS practice under real conditions', time: '3 hours • Full Test' },
};

function TestCard({ test, type, userId }) {
    const [result, setResult] = useState(undefined); // undefined = loading

    useEffect(() => {
        if (!userId || !test.id) return;
        getUserTestResult(userId, type, test.id).then(r => setResult(r));
    }, [userId, type, test.id]);

    const handleTestClick = () => {
        window.location.href = getTestUrl(type, test.id);
    };

    const handleResultClick = (e) => {
        if (result) {
            e.stopPropagation();
            window.location.href = getResultUrl(type, result.id);
        }
    };

    const testTitle = test.title || test.name || `${formatType(type)} Test ${test.id ? (test.id.match(/\d+/) ? test.id.match(/\d+/)[0] : '') : ''}`.trim();
    const testDesc = test.description || TYPE_MAP[type]?.desc || '';

    return (
        <div className="test-card glass-card" onClick={handleTestClick}>
            <div className="test-card-header">
                <span className="test-card-icon">{getTypeIcon(type)}</span>
                <div className="test-card-info">
                    <h4>{testTitle}</h4>
                    <p>{TYPE_MAP[type]?.time}</p>
                </div>
                <ArrowRight size={18} className="test-card-arrow" />
            </div>
            {testDesc && <p className="test-card-desc">{testDesc}</p>}
            <div className="test-card-result">
                {result === undefined ? (
                    <div className="result-loading"><div className="spinner-sm" /> Loading result...</div>
                ) : result === null ? (
                    <div className="result-empty">Take this test to see your score</div>
                ) : (
                    <div className="result-badge" onClick={handleResultClick}>
                        <span className="result-score-text">
                            {type === 'fullmock'
                                ? `Band ${result.overallBand || 'N/A'}`
                                : type === 'writing'
                                    ? `${result.totalWordCount || 0} words`
                                    : `${result.score || 0}/${result.total || 40} correct`}
                        </span>
                        {type !== 'writing' && type !== 'fullmock' && (
                            <span className={`band-pill ${getBandClass(convertToIELTS(result.score || 0, result.total || 40, type))}`}>
                                Band {convertToIELTS(result.score || 0, result.total || 40, type)}
                            </span>
                        )}
                        {type === 'fullmock' && result.overallBand && (
                            <span className={`band-pill ${getBandClass(result.overallBand)}`}>
                                Overall
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TestSection() {
    const { type } = useParams();
    const { user } = useAuth();
    const { tests, loading } = useTests(type);
    const meta = TYPE_MAP[type] || { title: 'Tests', desc: '' };

    return (
        <div className="test-section page-enter">
            <div className="test-section-header">
                <span className="test-section-icon">{getTypeIcon(type)}</span>
                <div>
                    <h2>{meta.title}</h2>
                    <p>{meta.desc}</p>
                </div>
            </div>

            {loading ? (
                <TestListSkeleton />
            ) : tests.length === 0 ? (
                <div className="empty-state glass-card">
                    <span className="empty-icon">{getTypeIcon(type)}</span>
                    <p>No tests available yet. Check back soon!</p>
                </div>
            ) : (
                <div className="test-list">
                    {tests.map(test => (
                        <TestCard key={test.id} test={test} type={type} userId={user?.uid} />
                    ))}
                </div>
            )}
        </div>
    );
}
