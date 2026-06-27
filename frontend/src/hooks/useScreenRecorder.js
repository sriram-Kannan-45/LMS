import { useState, useCallback, useEffect } from 'react'
import { API_BASE } from '../api/api'

function getAuthToken() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.token || parsed?.accessToken || null
  } catch { return null }
}

// Module-level singleton so the recorder can survive route navigations.
let globalMediaRecorder = null
let globalStream = null
let globalChunks = []
const listeners = new Set()

function notify() {
  listeners.forEach((cb) => cb())
}

export default function useScreenRecorder({
  assessmentType = 'quiz',
  assessmentId,
  codingAttemptId,
  participantId,
  sessionId,
  userToken,
  autoStop = true,
} = {}) {
  const [, forceUpdate] = useState(0)
  const [error, setError] = useState(null)
  const [chunks, setChunks] = useState([])

  useEffect(() => {
    const cb = () => forceUpdate((n) => n + 1)
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      if (globalMediaRecorder && globalMediaRecorder.state !== 'inactive') {
        return true
      }

      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
        audio: false
      })
      globalStream = mediaStream
      notify()

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

      const recorder = new MediaRecorder(mediaStream, { mimeType })
      globalMediaRecorder = recorder
      globalChunks = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          globalChunks.push(e.data)
          setChunks([...globalChunks])
        }
      }

      recorder.onstop = () => {
        notify()
      }

      recorder.onerror = (err) => {
        setError(err.message || 'Recording error')
      }

      recorder.start(5000)
      setError(null)
      notify()
      return true
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Screen sharing was denied. Please allow screen sharing for proctored quizzes.')
      } else {
        setError(err.message || 'Failed to start screen recording')
      }
      return false
    }
  }, [])

  const stopRecording = useCallback(async () => {
    return new Promise((resolve) => {
      if (!globalMediaRecorder || globalMediaRecorder.state === 'inactive') {
        resolve(null)
        return
      }

      const originalOnStop = globalMediaRecorder.onstop
      globalMediaRecorder.onstop = () => {
        if (originalOnStop) originalOnStop()
        notify()
      }

      globalMediaRecorder.stop()

      if (globalStream) {
        globalStream.getTracks().forEach(track => track.stop())
        globalStream = null
        notify()
      }

      const blob = new Blob(globalChunks, { type: 'video/webm' })
      resolve(blob)
    })
  }, [])

  const uploadRecording = useCallback(async (blob) => {
    if (!blob || !assessmentId || !participantId || !sessionId) return null
    const token = userToken || getAuthToken()
    if (!token) {
      setError('Auth token missing')
      return null
    }
    try {
      const formData = new FormData()
      formData.append('recording', blob, `${assessmentType}_${assessmentId}_${participantId}_${Date.now()}.webm`)
      formData.append('assessment_type', assessmentType)
      formData.append('participantId', participantId)
      formData.append('sessionId', sessionId)
      if (assessmentType === 'quiz') {
        formData.append('quizId', assessmentId)
      } else if (assessmentType === 'coding_assessment') {
        formData.append('assessmentId', assessmentId)
        if (codingAttemptId) formData.append('codingAttemptId', codingAttemptId)
      }

      const res = await fetch(`${API_BASE}/recordings/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed')
      return data.data
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [assessmentType, assessmentId, codingAttemptId, participantId, sessionId, userToken])

  const cleanup = useCallback(() => {
    if (globalStream) {
      globalStream.getTracks().forEach(track => track.stop())
      globalStream = null
    }
    if (globalMediaRecorder && globalMediaRecorder.state !== 'inactive') {
      globalMediaRecorder.stop()
    }
    globalMediaRecorder = null
    globalChunks = []
    setChunks([])
    notify()
  }, [])

  useEffect(() => {
    if (autoStop === false) return
    return () => cleanup()
  }, [cleanup, autoStop])

  return {
    recording: globalMediaRecorder && globalMediaRecorder.state !== 'inactive',
    stream: globalStream,
    error,
    chunks,
    startRecording,
    stopRecording,
    uploadRecording,
    cleanup
  }
}
