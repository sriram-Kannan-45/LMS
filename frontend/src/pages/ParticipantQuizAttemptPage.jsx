import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import QuizTaking from '../components/QuizTaking'
import AssessmentConsentGate from '../components/ai-quizzes/AssessmentConsentGate'
import { API_BASE } from '../api/api'
import { useToast } from '../components/Toast'
import { Loader2, AlertCircle } from 'lucide-react'
import { ProctorProvider, useProctor } from '../proctoring/ProctorContext'
import useDeviceFingerprint from '../proctoring/hooks/useDeviceFingerprint'
import useScreenRecorder from '../hooks/useScreenRecorder'
import RecordingIndicator from '../components/shared/RecordingIndicator'

const authHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
})

function ParticipantQuizAttemptPageInner({ user }) {
  const navigate = useNavigate()
  const { trainingId, quizId } = useParams()
  const [searchParams] = useSearchParams()
  const { error: showError } = useToast()
  const proctor = useProctor()
  const fp = useDeviceFingerprint()
  const {
    recording: screenRecording,
    startRecording,
    stopRecording,
    uploadRecording,
    error: recorderError
  } = useScreenRecorder({
    assessmentType: 'quiz',
    assessmentId: quizId,
    participantId: user?.id,
    sessionId: searchParams.get('sessionId') || `session_${Date.now()}`,
    userToken: user?.token
  })

  let attemptId = searchParams.get('attemptId')
  let sessionToken = searchParams.get('sessionToken')

  if (quizId) {
    const storageKey = `quiz_${quizId}_attempt`
    if (attemptId && sessionToken) {
      sessionStorage.setItem(storageKey, JSON.stringify({ attemptId, sessionToken }))
    } else {
      const cached = sessionStorage.getItem(storageKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          attemptId = attemptId || parsed.attemptId
          sessionToken = sessionToken || parsed.sessionToken
        } catch (e) {
          console.error('[ParticipantQuizAttemptPage] Error parsing cached session:', e)
        }
      }
    }
  }

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)
  const [quizData, setQuizData] = useState(null)
  const [consented, setConsented] = useState(false)
  const [screenStream, setScreenStream] = useState(null)
  const [sessionError, setSessionError] = useState(null)
  const [screenShareResuming, setScreenShareResuming] = useState(false)
  const resumedStreamRef = useRef(null)

  useEffect(() => {
    if (!quizId || !attemptId) {
      setErrorMsg('Invalid quiz or attempt identifiers.')
      setLoading(false)
      return
    }

    let aborted = false
    const fetchQuestions = async () => {
      try {
        setLoading(true)
        const requestUrl = `${API_BASE}/quizzes/${quizId}/questions`

        const res = await fetch(requestUrl, {
          headers: authHeaders(user.token)
        })

        const data = await res.json()

        if (aborted) return

        if (!res.ok) {
          setErrorMsg(data.error || 'Failed to load quiz questions.')
          setLoading(false)
          return
        }

        setQuizData({
          id: data.quiz.id,
          title: data.quiz.title,
          timeLimit: data.quiz.timeLimit,
          copyProtectionEnabled: data.quiz.copyProtectionEnabled,
          maxCopyWarnings: data.quiz.maxCopyWarnings,
          copyViolationActions: data.quiz.copyViolationActions,
          copyWarningMessage: data.quiz.copyWarningMessage,
          copyDisqualifyAction: data.quiz.copyDisqualifyAction,
          proctoringEnabled: true,
          proctoringLevel: data.quiz.proctoringLevel || 'MEDIUM',
          gracePeriodMinutes: data.quiz.gracePeriodMinutes || 2,
          initialViolationCount: data.attempt?.violationCount || 0,
          initialStatus: data.attempt?.status || 'IN_PROGRESS',
          questions: data.questions || []
        })
        setLoading(false)
      } catch (err) {
        if (!aborted) {
          setErrorMsg(err.message || 'Server error loading quiz.')
          setLoading(false)
        }
      }
    }

    fetchQuestions()
    return () => { aborted = true }
  }, [quizId, attemptId, user.token])

  const handleScreenShareReady = useCallback(async (stream) => {
    if (!stream) return
    console.log('[ParticipantQuizAttemptPage] Screen share ready, MediaStream created')
    setScreenStream(stream)
    setSessionError(null)
    proctor.setScreenStream(stream)
    try {
      console.log('[ParticipantQuizAttemptPage] Starting proctor session...')
      const s = await proctor.start({
        quizId: Number(quizId),
        attemptId: Number(attemptId),
        fingerprintHash: fp,
        screenSharing: true,
      })
      console.log('[ParticipantQuizAttemptPage] Activating proctor session...')
      await proctor.activate(s.sessionId, s.sessionToken)
      console.log('[ParticipantQuizAttemptPage] Proctor session active:', proctor.session?.sessionId)
      startRecording()
    } catch (err) {
      console.error('[ParticipantQuizAttemptPage] Failed to start proctor session:', err)
      setSessionError(err?.message || 'Failed to start proctoring session.')
      stream.getTracks().forEach(t => t.stop())
      setScreenStream(null)
      proctor.setScreenStream(null)
    }
  }, [quizId, attemptId, fp, proctor, startRecording])

  const handleScreenShareResumed = useCallback((newStream) => {
    if (!newStream) return
    console.log('[ParticipantQuizAttemptPage] Screen share resumed, replacing stream')
    setScreenStream(newStream)
    proctor.setScreenStream(newStream)
    proctor.pushState?.({ isScreenSharing: true })
    resumedStreamRef.current = newStream
    setScreenShareResuming(false)
  }, [proctor])

  const handleConsented = useCallback(() => {
    setConsented(true)
  }, [])

  const handleCancel = useCallback(() => {
    // Stop screen share if active
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop())
    }
    navigate(`/trainings/${trainingId}`)
  }, [navigate, trainingId, screenStream])

  const handleRetrySession = useCallback(async () => {
    setSessionError(null)
    if (screenStream) {
      await handleScreenShareReady(screenStream)
    }
  }, [screenStream, handleScreenShareReady])

  const handleCancelFromSessionError = useCallback(() => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop())
    }
    navigate(`/trainings/${trainingId}`)
  }, [navigate, trainingId, screenStream])

  const handleSubmit = useCallback(async () => {
    if (screenRecording) {
      const blob = await stopRecording()
      if (blob) {
        await uploadRecording(blob)
      }
    }
    navigate(`/trainings/${trainingId}/quizzes/${quizId}/result`)
  }, [screenRecording, stopRecording, uploadRecording, trainingId, quizId, navigate])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'Manrope', 'Poppins', sans-serif"
      }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} size={36} />
        <span style={{ marginTop: '12px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
          Initializing Quiz Session...
        </span>
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: 20,
        fontFamily: "'Manrope', 'Poppins', sans-serif"
      }}>
        <AlertCircle size={48} color="#dc2626" style={{ marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Unable to Start Quiz
        </h3>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 400, margin: '0 0 20px', lineHeight: 1.5 }}>
          {errorMsg}
        </p>
        <button
          onClick={() => navigate('/participant')}
          style={{
            padding: '10px 20px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          Return to Dashboard
        </button>
      </div>
    )
  }

  // Show consent gate before starting the quiz
  if (!consented && quizData) {
    return (
      <AssessmentConsentGate
        quiz={quizData}
        attemptId={parseInt(attemptId, 10)}
        onConsented={handleConsented}
        onCancel={handleCancel}
        onScreenShareReady={handleScreenShareReady}
      />
    )
  }

  // Session start error overlay (non-blocking retry/cancel)
  if (sessionError) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <div style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440, padding: 24,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <AlertCircle size={28} color="#dc2626" />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Screen sharing is mandatory to attend this assessment.
            </h3>
          </div>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
            {sessionError}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={handleCancelFromSessionError}
              style={{
                padding: '10px 18px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0',
                borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel Assessment
            </button>
            <button
              onClick={handleRetrySession}
              style={{
                padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <RecordingIndicator recording={screenRecording} />
      <QuizTaking
        quizId={parseInt(quizId, 10)}
        attemptId={parseInt(attemptId, 10)}
        quizData={quizData}
        sessionToken={sessionToken}
        isStandardQuiz={true}
        screenStream={screenStream}
        examSession={proctor.session}
        onScreenShareResumed={handleScreenShareResumed}
        onSubmit={handleSubmit}
      />
    </>
  )
}

export default function ParticipantQuizAttemptPage({ user }) {
  return (
    <ProctorProvider>
      <ParticipantQuizAttemptPageInner user={user} />
    </ProctorProvider>
  )
}
