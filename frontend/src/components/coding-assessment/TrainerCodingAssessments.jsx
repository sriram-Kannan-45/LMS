import { useEffect, useState } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';
import CodingAssessmentForm from './CodingAssessmentForm';
import CodingAssessmentResults from './CodingAssessmentResults';

/** Trainer "Coding Tests" tab — list, create, and view results inline. */
export default function TrainerCodingAssessments() {
  const [view, setView] = useState('list'); // list | create | results
  const [selected, setSelected] = useState(null);
  const [list, setList] = useState([]);

  const load = async () => {
    try {
      const res = await fetch(API.CODING.ASSESSMENTS, { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) setList(data.assessments || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { load(); }, []);

  if (view === 'create') return <CodingAssessmentForm onClose={() => { setView('list'); load(); }} />;
  if (view === 'results') return (
    <div>
      <button onClick={() => setView('list')} className="mb-3 text-sm text-violet-700">← Back to list</button>
      <CodingAssessmentResults assessmentId={selected} />
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Coding Assessments</h3>
        <button onClick={() => setView('create')} className="rounded bg-violet-600 px-4 py-2 text-sm text-white">+ New Assessment</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{a.title}</h4>
              <span className={`rounded px-2 py-0.5 text-xs ${a.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{a.description || 'No description'}</p>
            <button onClick={() => { setSelected(a.id); setView('results'); }} className="mt-3 text-sm font-medium text-violet-700">View results →</button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-gray-400">No coding assessments yet.</p>}
      </div>
    </div>
  );
}
