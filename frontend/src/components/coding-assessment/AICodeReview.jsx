import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';

/**
 * Module B — AI code review panel. Props: { submissionId, language }
 * Triggers review on button click; renders structured feedback.
 */
export default function AICodeReview({ submissionId, language = 'python' }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSnippet, setShowSnippet] = useState(false);

  const fetchReview = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(API.CODING.REVIEW(submissionId), {
        method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      setReview(data.review);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  if (!review) {
    return (
      <div className="mt-2">
        <button type="button" onClick={fetchReview} disabled={loading}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60">
          {loading ? 'Reviewing…' : '🤖 Get AI Review'}
        </button>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const List = ({ items, icon, color }) => (
    <ul className="mt-1 space-y-1 text-sm">
      {(items || []).map((t, i) => (
        <li key={i} className={color}>{icon} {t}</li>
      ))}
    </ul>
  );

  return (
    <div className="mt-2 rounded-lg border bg-white p-4 shadow-sm">
      <p className="italic text-gray-700">{review.summary}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-green-700">Strengths</p>
          <List items={review.strengths} icon="✅" color="text-green-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-700">Weaknesses</p>
          <List items={review.weaknesses} icon="⚠️" color="text-amber-700" />
        </div>
      </div>

      <div className="mt-3 flex gap-6 text-sm">
        <span><b>Time:</b> {review.time_complexity || '—'}</span>
        <span><b>Space:</b> {review.space_complexity || '—'}</span>
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold text-blue-700">Suggestions</p>
        <List items={review.suggestions} icon="💡" color="text-blue-700" />
      </div>

      {review.optimized_snippet ? (
        <div className="mt-3">
          <button type="button" onClick={() => setShowSnippet((s) => !s)}
            className="text-sm font-medium text-violet-700">
            {showSnippet ? 'Hide suggestion' : 'Show suggestion'}
          </button>
          {showSnippet && (
            <div className="mt-2 overflow-hidden rounded border">
              <Editor height="220px" language={language} value={review.optimized_snippet}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
