import { useState } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';
import AIQuestionGenerator from './AIQuestionGenerator';

const emptyManual = { title: '', problemDescription: '', difficulty: 'medium', marks: 10, sampleInput: '', sampleOutput: '',
  testCases: [{ input: '', expectedOutput: '', isHidden: false }] };

/** Trainer authoring flow. Props: { onClose } */
export default function CodingAssessmentForm({ onClose }) {
  const [step, setStep] = useState(1);
  const [assessment, setAssessment] = useState(null);
  const [details, setDetails] = useState({ title: '', description: '', timeLimit: 60 });
  const [questions, setQuestions] = useState([]);
  const [manual, setManual] = useState(emptyManual);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState('');

  const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' };

  const createAssessment = async () => {
    setError('');
    if (!details.title.trim()) { setError('Title required'); return; }
    try {
      const res = await fetch(API.CODING.ASSESSMENTS, { method: 'POST', headers, body: JSON.stringify(details) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setAssessment(data.assessment);
      setStep(2);
    } catch (e) { setError(e.message); }
  };

  const addManual = async () => {
    setError('');
    if (!manual.title.trim() || !manual.problemDescription.trim()) { setError('Title & description required'); return; }
    try {
      const res = await fetch(API.CODING.QUESTIONS(assessment.id), { method: 'POST', headers, body: JSON.stringify(manual) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Add failed');
      setQuestions((q) => [...q, data.question]);
      setManual(emptyManual); setShowManual(false);
    } catch (e) { setError(e.message); }
  };

  const publish = async () => {
    try {
      const res = await fetch(API.CODING.ASSESSMENT(assessment.id), {
        method: 'PUT', headers, body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Publish failed'); }
      onClose?.(true);
    } catch (e) { setError(e.message); }
  };

  const setTC = (i, key, val) => setManual((m) => ({
    ...m, testCases: m.testCases.map((t, j) => (j === i ? { ...t, [key]: val } : t)),
  }));

  if (step === 1) {
    return (
      <div className="max-w-lg rounded-lg border bg-white p-5">
        <h3 className="mb-3 text-lg font-semibold">New Coding Assessment</h3>
        <input className="mb-2 w-full rounded border px-3 py-2 text-sm" placeholder="Title"
          value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} />
        <textarea className="mb-2 w-full rounded border px-3 py-2 text-sm" placeholder="Description"
          value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} />
        <input type="number" className="mb-3 w-32 rounded border px-3 py-2 text-sm" placeholder="Minutes"
          value={details.timeLimit} onChange={(e) => setDetails({ ...details, timeLimit: +e.target.value })} />
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => onClose?.(false)} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={createAssessment} className="rounded bg-violet-600 px-4 py-2 text-sm text-white">Next: Questions</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl rounded-lg border bg-white p-5">
      <h3 className="mb-1 text-lg font-semibold">{assessment.title} — Questions</h3>
      <div className="mb-3 flex gap-2">
        <button onClick={() => setShowManual((s) => !s)} className="rounded bg-gray-700 px-3 py-2 text-sm text-white">Add Question Manually</button>
        <AIQuestionGenerator assessmentId={assessment.id} onGenerated={(q) => setQuestions((list) => [...list, q])} />
      </div>

      {showManual && (
        <div className="mb-3 rounded border p-3">
          <input className="mb-2 w-full rounded border px-3 py-2 text-sm" placeholder="Title"
            value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
          <textarea className="mb-2 w-full rounded border px-3 py-2 text-sm" placeholder="Problem description"
            value={manual.problemDescription} onChange={(e) => setManual({ ...manual, problemDescription: e.target.value })} />
          <div className="mb-2 flex gap-2">
            <select value={manual.difficulty} onChange={(e) => setManual({ ...manual, difficulty: e.target.value })} className="rounded border px-2 py-1 text-sm">
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
            <input type="number" className="w-24 rounded border px-2 py-1 text-sm" placeholder="Marks"
              value={manual.marks} onChange={(e) => setManual({ ...manual, marks: +e.target.value })} />
          </div>
          {manual.testCases.map((t, i) => (
            <div key={i} className="mb-1 flex gap-2">
              <input className="flex-1 rounded border px-2 py-1 text-xs" placeholder="Input" value={t.input} onChange={(e) => setTC(i, 'input', e.target.value)} />
              <input className="flex-1 rounded border px-2 py-1 text-xs" placeholder="Expected output" value={t.expectedOutput} onChange={(e) => setTC(i, 'expectedOutput', e.target.value)} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={t.isHidden} onChange={(e) => setTC(i, 'isHidden', e.target.checked)} />hidden</label>
            </div>
          ))}
          <button onClick={() => setManual((m) => ({ ...m, testCases: [...m.testCases, { input: '', expectedOutput: '', isHidden: true }] }))}
            className="mb-2 text-xs text-violet-700">+ test case</button>
          <div className="text-right"><button onClick={addManual} className="rounded bg-green-600 px-3 py-1 text-sm text-white">Save Question</button></div>
        </div>
      )}

      <ul className="mb-3 space-y-1 text-sm">
        {questions.map((q, i) => <li key={q.id || i} className="rounded bg-gray-50 px-3 py-2">Q{i + 1}. {q.title} <span className="text-xs text-gray-500">({q.difficulty}, {q.marks} marks)</span></li>)}
        {questions.length === 0 && <li className="text-gray-400">No questions yet.</li>}
      </ul>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => onClose?.(true)} className="px-3 py-2 text-sm text-gray-600">Save Draft</button>
        <button onClick={publish} disabled={questions.length === 0} className="rounded bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50">Publish</button>
      </div>
    </div>
  );
}
