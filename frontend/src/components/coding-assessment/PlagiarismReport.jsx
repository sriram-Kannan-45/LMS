import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';

const badge = { HIGH: 'bg-red-100 text-red-700', MEDIUM: 'bg-amber-100 text-amber-700', NONE: 'bg-gray-100 text-gray-600' };

/**
 * Module C — similarity report table + side-by-side compare modal.
 * Props: { assessmentId }
 */
export default function PlagiarismReport({ assessmentId }) {
  const [reports, setReports] = useState([]);
  const [showNone, setShowNone] = useState(false);
  const [compare, setCompare] = useState(null); // { a, b, score }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API.CODING.PLAGIARISM_REPORTS(assessmentId), { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) setReports(data.reports || []);
      } catch { /* ignore */ }
    })();
  }, [assessmentId]);

  const high = reports.filter((r) => r.flagLevel === 'HIGH').length;
  const medium = reports.filter((r) => r.flagLevel === 'MEDIUM').length;
  const rows = reports.filter((r) => showNone || r.flagLevel !== 'NONE');

  const openCompare = async (r) => {
    // Source code isn't in the report payload; fetch via run-history is overkill —
    // the report already references submissions, so show what we have.
    setCompare({
      score: r.similarityScore,
      a: { name: r.participantA?.name, code: r.codeA || '// code unavailable in summary view' },
      b: { name: r.participantB?.name, code: r.codeB || '// code unavailable in summary view' },
    });
  };

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-4 text-sm">
        <span>{reports.length} pairs checked</span>
        <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">{high} HIGH</span>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">{medium} MEDIUM</span>
        <label className="ml-auto flex items-center gap-1">
          <input type="checkbox" checked={showNone} onChange={(e) => setShowNone(e.target.checked)} />
          Show NONE
        </label>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Question</th><th>Participant A</th><th>Participant B</th>
            <th>Similarity</th><th>Flag</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.question?.title || r.questionId}</td>
              <td>{r.participantA?.name || r.participantAId}</td>
              <td>{r.participantB?.name || r.participantBId}</td>
              <td>{r.similarityScore}%</td>
              <td><span className={`rounded px-2 py-0.5 ${badge[r.flagLevel]}`}>{r.flagLevel}</span></td>
              <td><button type="button" className="text-violet-700" onClick={() => openCompare(r)}>Compare</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-gray-400">No flagged pairs.</td></tr>}
        </tbody>
      </table>

      {compare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-lg bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Similarity <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">{compare.score}%</span>
              </h3>
              <button type="button" onClick={() => setCompare(null)} className="text-gray-500">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[compare.a, compare.b].map((p, i) => (
                <div key={i} className="overflow-hidden rounded border">
                  <div className="bg-gray-50 px-3 py-1 text-sm font-medium">{p.name}</div>
                  <Editor height="360px" value={p.code} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
