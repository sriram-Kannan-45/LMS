import { useState } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';
import CodingEditor from './CodingEditor';

/**
 * Two-step pre-flight: (1) mandatory screen share, (2) fullscreen + start.
 * Props: { assessmentId, onExit }
 */
export default function AssessmentLobby({ assessmentId, onExit }) {
  const [mediaStream, setMediaStream] = useState(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);

  const shareScreen = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      setMediaStream(stream);
    } catch {
      setError('Screen sharing is required to start this assessment.');
    }
  };

  const startAttempt = async () => {
    setError('');
    try {
      try { await document.documentElement.requestFullscreen(); } catch { /* non-fatal */ }
      const startRes = await fetch(API.CODING.START(assessmentId), {
        method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || 'Could not start');
      const qRes = await fetch(API.CODING.P_ASSESSMENT(assessmentId), { headers: getAuthHeaders() });
      const qData = await qRes.json();
      if (!qRes.ok) throw new Error(qData.error || 'Could not load assessment');
      setAttemptId(startData.attempt.id);
      setAssessment(qData.assessment);
      setQuestions(qData.questions || []);
      setStarted(true);
    } catch (e) { setError(e.message); }
  };

  if (started) {
    return (
      <CodingEditor assessment={assessment} questions={questions} attemptId={attemptId}
        mediaStream={mediaStream} setMediaStream={setMediaStream} onExit={onExit} />
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold">Assessment Pre-flight</h2>
      <p className="mt-1 text-sm text-gray-600">This assessment requires screen sharing.</p>

      <div className="mt-4">
        {mediaStream
          ? <p className="font-medium text-green-600">● Screen sharing active</p>
          : <button onClick={shareScreen} className="rounded bg-blue-600 px-4 py-2 text-white">Share Screen</button>}
      </div>

      <button onClick={startAttempt} disabled={!mediaStream}
        className="mt-5 w-full rounded bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">
        Enter Fullscreen &amp; Start
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
