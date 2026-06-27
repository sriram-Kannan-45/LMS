import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Loader2,
  Maximize2,
  MonitorPlay,
  ShieldCheck,
} from 'lucide-react';
import { API_BASE, codingAttemptApi, getAuthHeaders } from '../../api/api';
import { useToast } from '../../components/Toast';
import useScreenRecorder from '../../hooks/useScreenRecorder';
import { ProctorProvider, useProctor } from '../../proctoring/ProctorContext';
import useDeviceFingerprint from '../../proctoring/hooks/useDeviceFingerprint';

const fsApi = {
  request: (el = document.documentElement) =>
    (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el),
  element: () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement,
};

function normalizeAssessment(data) {
  return data?.assessment || data?.data || data || null;
}

function normalizeAttempt(data) {
  return data?.attempt || data?.data || data || null;
}

function CodingAssessmentAttemptInner({ user }) {
  const { trainingId, assessmentId } = useParams();
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const proctor = useProctor();
  const fingerprintHash = useDeviceFingerprint();

  const [assessment, setAssessment] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [consented, setConsented] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);

  const {
    stream: screenStream,
    startRecording,
    cleanup: cleanupRecorder,
    error: recorderError,
  } = useScreenRecorder({
    assessmentType: 'coding_assessment',
    assessmentId,
    codingAttemptId: attempt?.id,
    participantId: user?.id,
    sessionId: sessionToken,
    userToken: user?.token,
    autoStop: false,
  });

  // Bootstrap: load assessment details and get/create the attempt.
  useEffect(() => {
    if (!assessmentId) {
      setErrorMsg('Invalid assessment identifier.');
      setLoading(false);
      return;
    }

    let aborted = false;
    async function bootstrap() {
      try {
        setLoading(true);
        const assessmentRes = await fetch(
          `${API_BASE}/coding-assessments/${assessmentId}/participant`,
          { headers: getAuthHeaders() }
        );
        const assessmentData = await assessmentRes.json();
        if (!assessmentRes.ok) {
          throw new Error(assessmentData?.error || assessmentData?.message || 'Failed to load assessment.');
        }

        const attemptRes = await codingAttemptApi.start(assessmentId);
        const attemptData = await attemptRes.json();
        if (!attemptRes.ok) {
          throw new Error(attemptData?.error || attemptData?.message || 'Failed to start coding attempt.');
        }

        if (aborted) return;

        const assessmentObj = normalizeAssessment(assessmentData);

        if (attemptData?.status === 'SUBMITTED') {
          navigate(`/trainings/${trainingId}/assessments/${assessmentId}/result`, { replace: true });
          return;
        }

        const attemptId = attemptData?.attemptId || attemptData?.attempt?.id || attemptData?.id;
        if (!attemptId) {
          throw new Error('No attempt id returned from start endpoint.');
        }

        const returnedToken = attemptData?.sessionToken || attemptData?.data?.sessionToken || null;
        if (returnedToken) {
          setSessionToken(returnedToken);
        }

        sessionStorage.setItem(`coding_attempt_${assessmentId}`, String(attemptId));

        const fullAttemptRes = await codingAttemptApi.get(attemptId);
        const fullAttemptData = await fullAttemptRes.json();
        if (!fullAttemptRes.ok) {
          throw new Error(fullAttemptData?.error || fullAttemptData?.message || 'Failed to load attempt details.');
        }

        const attemptObj = normalizeAttempt(fullAttemptData);

        if (attemptObj?.sessionId && !returnedToken) {
          setSessionToken(attemptObj.sessionId);
        }

        setAssessment(assessmentObj);
        setAttempt(attemptObj);
      } catch (err) {
        if (!aborted) {
          setErrorMsg(err?.message || 'Server error while loading assessment.');
        }
      } finally {
        if (!aborted) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      aborted = true;
    };
  }, [assessmentId, trainingId, navigate]);

  // Listen for the user stopping screen share via the browser chrome.
  useEffect(() => {
    if (!screenStream) return;
    const handleEnded = () => {
      setErrorMsg('Screen sharing was stopped. You must share your screen to take this assessment.');
      setStarting(false);
    };
    const tracks = screenStream.getVideoTracks();
    tracks.forEach((track) => track.addEventListener('ended', handleEnded));
    return () => {
      tracks.forEach((track) => track.removeEventListener('ended', handleEnded));
    };
  }, [screenStream]);

  // Once the screen recorder has acquired the stream, start proctoring and enter fullscreen.
  useEffect(() => {
    if (!starting || !screenStream || !attempt || !fingerprintHash) return;

    let aborted = false;
    async function proceed() {
      try {
        proctor.setScreenStream(screenStream);

        const session = await proctor.start({
          assessmentType: 'coding_assessment',
          assessmentId: Number(assessmentId),
          attemptId: Number(attempt.id),
          fingerprintHash,
          screenSharing: true,
        });

        await proctor.activate(session.sessionId, session.sessionToken);

        const fsPromise = fsApi.request();
        if (fsPromise && typeof fsPromise.then === 'function') await fsPromise;
        await new Promise((resolve) => setTimeout(resolve, 60));

        if (!fsApi.element()) {
          throw new Error('Fullscreen permission was denied.');
        }

        if (!aborted) {
          navigate(`/trainings/${trainingId}/assessments/${assessmentId}/exam`, {
            state: {
              attempt,
              assessment,
              sessionToken: session.sessionToken,
              sessionId: session.sessionId,
            },
          });
        }
      } catch (err) {
        if (!aborted) {
          setErrorMsg(err?.message || 'Failed to start proctoring session.');
          setStarting(false);
          screenStream.getTracks().forEach((track) => track.stop());
          proctor.setScreenStream(null);
        }
      }
    }

    proceed();
    return () => {
      aborted = true;
    };
  }, [starting, screenStream, attempt, fingerprintHash, proctor, assessmentId, trainingId, navigate, assessment]);

  const handleStart = useCallback(async () => {
    if (!consented) {
      showError('Please accept the monitoring terms to continue.');
      return;
    }
    if (!attempt) return;

    setErrorMsg(null);
    setStarting(true);

    const started = await startRecording();
    if (!started) {
      setErrorMsg(recorderError || 'Screen recording was denied. Please allow screen sharing.');
      setStarting(false);
    }
  }, [consented, attempt, startRecording, recorderError, showError]);

  const handleCancel = useCallback(() => {
    cleanupRecorder();
    navigate('/participant');
  }, [cleanupRecorder, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 text-slate-700">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="mt-4 text-sm font-semibold">Preparing assessment...</p>
      </div>
    );
  }

  if (errorMsg && !starting) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-lg font-bold text-slate-900">Unable to Start Assessment</h2>
          <p className="mb-6 text-sm text-slate-600">{errorMsg}</p>
          <button
            type="button"
            onClick={() => navigate('/participant')}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const problemCount = assessment?.questions?.length ?? assessment?.problemCount ?? 0;
  const durationMinutes = assessment?.durationMinutes ?? assessment?.duration ?? 0;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/60 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{assessment?.title || 'Coding Assessment'}</h1>
            <p className="text-sm text-slate-500">Please review the requirements before starting.</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <Clock className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-xs font-medium text-slate-500">Duration</p>
              <p className="text-sm font-semibold text-slate-900">{durationMinutes} minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <Code2 className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-xs font-medium text-slate-500">Problems</p>
              <p className="text-sm font-semibold text-slate-900">{problemCount} problem{problemCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-blue-600" /> Assessment Rules
          </h2>
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>Screen sharing is mandatory. Your screen will be shared live with your trainer for the entire duration.</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>The assessment runs in fullscreen. Exiting fullscreen will register a violation.</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>Copying content, switching applications, or using unauthorised resources is strictly prohibited.</span>
          </div>
        </div>

        <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-1 h-4 w-4 accent-amber-600"
          />
          <span className="text-sm font-medium text-amber-900">
            I understand and agree that my screen, browser activity, and device information will be monitored during this assessment.
          </span>
        </label>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={starting}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!consented || starting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Starting...
              </>
            ) : (
              <>
                Enable Fullscreen & Start Assessment <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CodingAssessmentAttempt({ user }) {
  return (
    <ProctorProvider>
      <CodingAssessmentAttemptInner user={user} />
    </ProctorProvider>
  );
}
