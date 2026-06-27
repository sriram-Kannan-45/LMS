import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import CodeEditor from '../../components/CodeEditor';
import ProblemPanel from '../../components/ProblemPanel';
import TestResultsPanel from '../../components/TestResultsPanel';
import useCodeExecution from '../../hooks/useCodeExecution';
import { codingAttemptApi } from '../../api/api';
import useScreenRecorder from '../../hooks/useScreenRecorder';
import { formatRemainingTime, getRemainingMs } from '../../utils/examTime';
import { ProctorProvider, useProctor } from '../../proctoring/ProctorContext';

const fsApi = {
  element: () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement,
};

function CodingExamShellInner({ attempt: attemptProp, onSubmit }) {
  const { trainingId, assessmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const submittingRef = useRef(false);

  const [attempt, setAttempt] = useState(() => attemptProp || location.state?.attempt || null);
  const [loadingAttempt, setLoadingAttempt] = useState(!attemptProp && !location.state?.attempt);
  const [loadError, setLoadError] = useState('');
  const [currentProblemIdx, setCurrentProblemIdx] = useState(0);
  const [codeByProblem, setCodeByProblem] = useState({});
  const [remainingMs, setRemainingMs] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);

  const proctor = useProctor();

  const routeState = location.state || {};
  const sessionToken = attemptProp?.sessionToken ?? routeState.sessionToken ?? null;
  const sessionId = attemptProp?.sessionId ?? routeState.sessionId ?? null;
  const assessmentFromState = attemptProp?.assessment ?? routeState.assessment ?? null;

  const {
    stream: screenStream,
    stopRecording,
    uploadRecording,
  } = useScreenRecorder({
    assessmentType: 'coding_assessment',
    assessmentId,
    codingAttemptId: attempt?.id,
    participantId: attempt?.participantId,
    sessionId,
    autoStop: false,
  });

  const { run, submit, results, loading: execLoading, clearResults } = useCodeExecution();

  const assessment = attempt?.assessment || assessmentFromState;
  const questions = assessment?.questions || [];
  const problem = questions[currentProblemIdx];
  const language = assessment?.language || 'javascript';
  const code = problem ? codeByProblem[problem.id] ?? '' : '';

  // Sync external attempt prop if it changes.
  useEffect(() => {
    if (attemptProp) {
      setAttempt(attemptProp);
    }
  }, [attemptProp]);

  // Initialise per-problem code from starter code whenever the attempt loads.
  useEffect(() => {
    if (!attempt) return;

    const initialCode = {};
    questions.forEach((q) => {
      initialCode[q.id] = q.starterCode ?? '';
    });
    setCodeByProblem(initialCode);
    setRemainingMs(getRemainingMs(attempt.startedAt, assessment?.durationMinutes));
    setLoadingAttempt(false);
  }, [attempt, questions, assessment?.durationMinutes]);

  // If no attempt was supplied, start one automatically from the URL assessment id.
  useEffect(() => {
    if (attempt || startedRef.current) return;
    startedRef.current = true;

    async function bootstrapAttempt() {
      try {
        const startRes = await codingAttemptApi.start(assessmentId);
        const startData = await startRes.json();
        if (!startRes.ok) {
          throw new Error(startData.error || 'Could not start coding attempt');
        }

        const attemptId = startData.attempt?.id || startData.id;
        if (!attemptId) {
          throw new Error('No attempt id returned from start endpoint');
        }

        const getRes = await codingAttemptApi.get(attemptId);
        const getData = await getRes.json();
        if (!getRes.ok) {
          throw new Error(getData.error || 'Could not load coding attempt');
        }

        setAttempt(getData.attempt || getData);
      } catch (err) {
        setLoadError(err.message);
      } finally {
        setLoadingAttempt(false);
      }
    }

    bootstrapAttempt();
  }, [attempt, assessmentId]);

  // Keep the timer ticking once per second.
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      setRemainingMs(getRemainingMs(attempt.startedAt, assessment?.durationMinutes));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [attempt, assessment?.durationMinutes]);

  // Clear execution results when switching problems to avoid stale data.
  useEffect(() => {
    clearResults();
  }, [currentProblemIdx, clearResults]);

  // Publish the screen stream to the proctor context so capture/WebRTC keep working.
  useEffect(() => {
    if (screenStream) {
      proctor.setScreenStream(screenStream);
    }
  }, [screenStream, proctor]);

  const finalizeSubmission = useCallback(
    async (reason = 'final_submit') => {
      if (!attempt || submittingRef.current) return;
      submittingRef.current = true;

      try {
        let blob = null;
        if (typeof stopRecording === 'function') {
          blob = await stopRecording();
        }
        if (blob && typeof uploadRecording === 'function') {
          await uploadRecording(blob);
        }
        if (sessionId && sessionToken) {
          await proctor.submit(sessionId, sessionToken);
        }

        const res = await codingAttemptApi.submit(attempt.id);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Final submission failed');
        }

        if (typeof onSubmit === 'function') {
          onSubmit();
        } else {
          navigate(`/trainings/${trainingId}/assessments/${assessmentId}/result`);
        }
      } catch (err) {
        setLoadError(err.message);
        submittingRef.current = false;
      }
    },
    [
      attempt,
      stopRecording,
      uploadRecording,
      sessionId,
      sessionToken,
      proctor,
      trainingId,
      assessmentId,
      navigate,
      onSubmit,
    ]
  );

  // Fullscreen violation handling.
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!fsApi.element()) {
        setFullscreenExits((prev) => prev + 1);
        proctor.report(
          'FULLSCREEN_EXIT',
          'Exited fullscreen during coding assessment',
          null,
          sessionId,
          sessionToken
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [proctor, sessionId, sessionToken]);

  // Tab switch handling.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        proctor.report(
          'TAB_SWITCH',
          'Switched tab during coding assessment',
          null,
          sessionId,
          sessionToken
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [proctor, sessionId, sessionToken]);

  // Window blur handling.
  useEffect(() => {
    const handleBlur = () => {
      proctor.report('WINDOW_BLUR', 'Left assessment window', null, sessionId, sessionToken);
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [proctor, sessionId, sessionToken]);

  // Auto-submit after 3 fullscreen exits.
  useEffect(() => {
    if (fullscreenExits >= 3 && !submittingRef.current) {
      setLoadError('Maximum fullscreen violations reached. Submitting assessment.');
      finalizeSubmission('max_fullscreen_violations');
    }
  }, [fullscreenExits, finalizeSubmission]);

  // Auto-submit on timer expiry.
  useEffect(() => {
    if (!attempt) return;
    if (remainingMs <= 0 && !submittingRef.current) {
      finalizeSubmission('timer_expired');
    }
  }, [attempt, remainingMs, finalizeSubmission]);

  const handleCodeChange = (value) => {
    if (!problem) return;
    setCodeByProblem((prev) => ({ ...prev, [problem.id]: value ?? '' }));
  };

  const handleRun = async () => {
    if (!problem) return;
    await run({ code, language, problemId: problem.id });
  };

  const handleSubmit = async () => {
    if (!problem || !attempt) return;
    await submit({ code, language, problemId: problem.id, attemptId: attempt.id });
  };

  const handleFinalSubmit = async () => {
    if (!attempt || submittingRef.current) return;

    const confirmed = window.confirm(
      'Are you sure you want to submit the entire assessment? This action cannot be undone.'
    );
    if (!confirmed) return;

    await finalizeSubmission('final_submit');
  };

  const problemTabs = useMemo(
    () =>
      questions.map((q, idx) => (
        <button
          key={q.id}
          type="button"
          onClick={() => setCurrentProblemIdx(idx)}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            idx === currentProblemIdx
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Q{idx + 1}
        </button>
      )),
    [questions, currentProblemIdx]
  );

  if (loadingAttempt) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          <p className="text-sm font-medium">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 p-6 text-center text-red-600">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Could not load exam</h2>
          <p className="text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!attempt || questions.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-600">
        <p>No exam data available.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      <header className="flex flex-none items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">{assessment.title}</h1>
          <p className="text-xs text-slate-500">Training {trainingId}</p>
        </div>
        <div className="flex flex-none items-center gap-4">
          <div className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
            Time remaining: {formatRemainingTime(remainingMs)}
          </div>
          <button
            type="button"
            onClick={handleFinalSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Final Submit
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-[40%_60%] overflow-hidden">
        <aside className="flex flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex flex-none gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2">
            {problemTabs}
          </div>
          <div className="flex-1 overflow-hidden">
            <ProblemPanel problem={problem} />
          </div>
        </aside>

        <section className="flex flex-col overflow-hidden">
          <div className="flex flex-none items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
            <div className="flex items-center gap-3">
              <label htmlFor="language-select" className="text-sm font-medium text-slate-600">
                Language
              </label>
              <select
                id="language-select"
                value={language}
                disabled
                className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-sm capitalize text-slate-700"
              >
                <option value={language}>{language}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRun}
                disabled={execLoading}
                className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Run
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={execLoading}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <CodeEditor value={code} language={language} onChange={handleCodeChange} height="100%" />
          </div>

          <div className="h-2/5 min-h-[180px] flex-none overflow-hidden border-t border-slate-200 bg-white">
            <TestResultsPanel results={results} loading={execLoading} />
          </div>
        </section>
      </main>
    </div>
  );
}

CodingExamShellInner.propTypes = {
  attempt: PropTypes.object,
  onSubmit: PropTypes.func,
};

export default function CodingExamShell(props) {
  return (
    <ProctorProvider>
      <CodingExamShellInner {...props} />
    </ProctorProvider>
  );
}
