import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';
import useProctoringGuard from './useProctoringGuard';
import AICodeReview from './AICodeReview';

const LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c'];

/**
 * Participant attempt UI. Props:
 *   { assessment, questions, attemptId, mediaStream, setMediaStream, onExit }
 */
export default function CodingEditor({ assessment, questions, attemptId, mediaStream, setMediaStream, onExit }) {
  const [active, setActive] = useState(0);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState({});           // questionId -> source
  const [runResults, setRunResults] = useState(null);
  const [submission, setSubmission] = useState({}); // questionId -> { id, status, passedCount, totalCount }
  const [busy, setBusy] = useState(false);

  const question = questions[active];
  const qid = question?.id;
  const src = code[qid] ?? '';

  const setSrc = (v) => setCode((c) => ({ ...c, [qid]: v ?? '' }));

  const callExec = useCallback(async (url) => {
    const res = await fetch(url, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: qid, language, sourceCode: src }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Execution failed');
    return data;
  }, [qid, language, src]);

  const run = async () => {
    setBusy(true); setRunResults(null);
    try { setRunResults(await callExec(API.CODING.RUN(attemptId))); }
    catch (e) { setRunResults({ error: e.message }); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const data = await callExec(API.CODING.SUBMIT(attemptId));
      setSubmission((s) => ({ ...s, [qid]: data.submission }));
      setRunResults({ results: data.results, passedCount: data.submission.passedCount, totalCount: data.submission.totalCount });
    } catch (e) { setRunResults({ error: e.message }); }
    finally { setBusy(false); }
  };

  // Auto-submit current question if screen-share grace elapses.
  const onAutoSubmit = useCallback(async () => {
    try { if (qid && src) await callExec(API.CODING.SUBMIT(attemptId)); } catch { /* ignore */ }
    onExit?.('auto-submitted');
  }, [qid, src, callExec, attemptId, onExit]);

  const { shareLost, countdown, resumeScreenShare } = useProctoringGuard({ attemptId, mediaStream, setMediaStream, onAutoSubmit });

  const sub = submission[qid];

  return (
    <div className="relative">
      {shareLost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 text-center text-white">
          <div className="max-w-md rounded-lg bg-red-700 p-6">
            <p className="text-lg font-semibold">⚠ Screen sharing stopped</p>
            <p className="mt-2 text-sm">Resume sharing within <b>{countdown}s</b> or your assessment will be auto-submitted.</p>
            <button onClick={resumeScreenShare} className="mt-4 rounded bg-white px-4 py-2 font-medium text-red-700">
              Resume screen share
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{assessment?.title}</h2>
        <span className="text-xs text-green-600">● screen sharing active</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {questions.map((q, i) => (
          <button key={q.id} onClick={() => { setActive(i); setRunResults(null); }}
            className={`rounded px-3 py-1 text-sm ${i === active ? 'bg-violet-600 text-white' : 'bg-gray-100'}`}>
            Q{i + 1}{submission[q.id] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold">{question?.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{question?.problemDescription}</p>
          {question?.constraints && <p className="mt-2 text-xs text-gray-500">Constraints: {question.constraints}</p>}
          {question?.sampleInput && (
            <pre className="mt-2 rounded bg-gray-50 p-2 text-xs">Input:{'\n'}{question.sampleInput}{'\n\n'}Output:{'\n'}{question.sampleOutput}</pre>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded border px-2 py-1 text-sm">
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button onClick={run} disabled={busy} className="rounded bg-gray-700 px-3 py-1 text-sm text-white disabled:opacity-60">Run</button>
            <button onClick={submit} disabled={busy} className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-60">Submit</button>
            <button onClick={() => onExit?.('exit')} className="ml-auto text-sm text-gray-500">Finish</button>
          </div>
          <div className="overflow-hidden rounded border">
            <Editor height="320px" language={language} value={src} onChange={setSrc}
              options={{ minimap: { enabled: false }, fontSize: 13 }} />
          </div>

          {runResults && (
            <div className="mt-2 rounded border p-2 text-sm">
              {runResults.error ? <p className="text-red-600">{runResults.error}</p> : (
                <>
                  <p className="font-medium">{runResults.passedCount}/{runResults.totalCount} test cases passed</p>
                  {(runResults.results || []).map((r, i) => (
                    <div key={i} className={r.status === 'PASSED' ? 'text-green-700' : 'text-red-600'}>
                      Test {i + 1}: {r.status}{r.isHidden ? ' (hidden)' : ''}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {sub && <AICodeReview submissionId={sub.id} language={language} />}
        </div>
      </div>
    </div>
  );
}
