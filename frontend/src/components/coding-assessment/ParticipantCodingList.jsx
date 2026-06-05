import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';

/** Participant "Coding Tests" tab — list published assessments and launch. */
export default function ParticipantCodingList() {
  const [list, setList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API.CODING.P_ASSESSMENTS, { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) setList(data.assessments || []);
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">Coding Assessments</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h4 className="font-semibold">{a.title}</h4>
            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{a.description || 'No description'}</p>
            <p className="mt-1 text-xs text-gray-400">⏱ {a.timeLimit} min</p>
            <button onClick={() => navigate(`/participant/coding/${a.id}`)}
              className="mt-3 rounded bg-violet-600 px-4 py-2 text-sm text-white">Start</button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-gray-400">No coding assessments available.</p>}
      </div>
    </div>
  );
}
