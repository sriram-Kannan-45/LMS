import { useEffect, useState } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';
import PlagiarismReport from './PlagiarismReport';

/** Trainer results page. Props: { assessmentId } */
export default function CodingAssessmentResults({ assessmentId }) {
  const [attempts, setAttempts] = useState([]);
  const [checking, setChecking] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API.CODING.RESULTS(assessmentId), { headers: getAuthHeaders() });
        const data = await res.json();
        if (res.ok) setAttempts(data.attempts || []);
      } catch { /* ignore */ }
    })();
  }, [assessmentId]);

  const runCheck = async () => {
    setChecking(true); setError('');
    try {
      const res = await fetch(API.CODING.PLAGIARISM_CHECK(assessmentId), {
        method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      setSummary(data.summary);
      setShowReport(true);
    } catch (e) { setError(e.message); } finally { setChecking(false); }
  };

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-lg font-semibold">Results</h3>
        <button onClick={runCheck} disabled={checking} className="ml-auto rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-60">
          {checking ? 'Checking…' : 'Run Plagiarism Check'}
        </button>
        {(summary || showReport) && (
          <button onClick={() => setShowReport((s) => !s)} className="rounded border px-3 py-2 text-sm">
            {showReport ? 'Hide' : 'View'} Similarity Report
          </button>
        )}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <table className="w-full border-collapse text-sm">
        <thead><tr className="border-b text-left text-gray-500"><th className="py-2">Participant</th><th>Status</th><th>Score</th><th>Violations</th></tr></thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="py-2">{a.participant?.name || a.participantId}</td>
              <td>{a.status}</td>
              <td>{Math.round(a.score)}</td>
              <td>{a.violationCount}</td>
            </tr>
          ))}
          {attempts.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-gray-400">No attempts yet.</td></tr>}
        </tbody>
      </table>

      {showReport && <PlagiarismReport assessmentId={assessmentId} />}
    </div>
  );
}
