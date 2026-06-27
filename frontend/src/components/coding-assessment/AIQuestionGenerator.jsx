import { useState } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';

/**
 * Module A — "Generate with AI" button + modal.
 * Props: { assessmentId, onGenerated(question) }
 */
export default function AIQuestionGenerator({ assessmentId, onGenerated }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [language, setLanguage] = useState('any');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) { setError('Enter a topic'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(API.CODING.GENERATE_Q(assessmentId), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, difficulty, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      onGenerated?.(data.question, data.testCases);
      setOpen(false); setTopic('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="px-3 py-2 rounded bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">
        ✨ Generate with AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold">Generate Coding Question</h3>
            <label className="block text-sm font-medium">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Binary Search, Graph BFS"
              className="mb-3 mt-1 w-full rounded border px-3 py-2 text-sm" />

            <div className="mb-3 flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-2 text-sm">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium">Language hint</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-2 text-sm">
                  <option value="any">Any</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                </select>
              </div>
            </div>

            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={loading}
                className="px-3 py-2 text-sm text-gray-600">Cancel</button>
              <button type="button" onClick={generate} disabled={loading}
                className="px-4 py-2 rounded bg-violet-600 text-white text-sm font-medium disabled:opacity-60">
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
