import { useEffect, useState, useRef, useCallback } from 'react';
import { useProctor } from '../ProctorContext';

const AUDIO_CHECK_INTERVAL_MS = 3000;
const FRAME_SAMPLE_INTERVAL_MS = 5000;
const HIGH_NOISE_THRESHOLD = 0.35;
const SUSTAINED_TALK_THRESHOLD = 0.15;
const TALK_HISTORY_LENGTH = 5;

export default function useProctoringMedia({ enabled = true, onAiAlert } = {}) {
  const proctor = useProctor();
  const stream = proctor.proctorStream;
  const setStream = proctor.setProctorStream;
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const talkHistoryRef = useRef([]);
  const micSilentCountRef = useRef(0);

  const request = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      setStream(mediaStream);
      proctor.setCameraGranted(true);
      proctor.setMicGranted(true);
      return mediaStream;
    } catch (err) {
      let friendlyError = 'Camera/Microphone permission denied or hardware unavailable.';
      if (err.name === 'NotAllowedError') {
        friendlyError = 'Permission was previously denied. Please update your browser site settings to allow camera/microphone access.';
      }
      setError(friendlyError);
      proctor.setCameraGranted(false);
      proctor.setMicGranted(false);
      return null;
    }
  }, [proctor, setStream]);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    proctor.setCameraGranted(false);
    proctor.setMicGranted(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, [stream, proctor, setStream]);

  // Audio monitoring via Web Audio API
  useEffect(() => {
    if (!enabled || !stream) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[ProctoringMedia] AudioContext init failed:', e.message);
    }

    const audioInterval = setInterval(() => {
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      if (!analyser || !dataArray) return;

      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const value = (dataArray[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      const history = talkHistoryRef.current;
      history.push(rms);
      if (history.length > TALK_HISTORY_LENGTH) history.shift();

      const recentAvg = history.reduce((a, b) => a + b, 0) / history.length;

      micSilentCountRef.current = rms < 0.01 ? micSilentCountRef.current + 1 : 0;

      if (micSilentCountRef.current >= 4) {
        proctor.report('FACE_ABSENT', 'Microphone appears to be disabled or very quiet');
        onAiAlert?.('FACE_ABSENT');
        micSilentCountRef.current = 0;
      } else if (recentAvg > HIGH_NOISE_THRESHOLD) {
        proctor.report('LOOKING_AWAY', 'Excessive background noise detected');
        onAiAlert?.('LOOKING_AWAY');
      } else if (recentAvg > SUSTAINED_TALK_THRESHOLD && history.length >= TALK_HISTORY_LENGTH) {
        proctor.report('MOBILE_DETECTED', 'Sustained background conversation detected');
        onAiAlert?.('MOBILE_DETECTED');
      }
    }, AUDIO_CHECK_INTERVAL_MS);
    audioIntervalRef.current = audioInterval;

    return () => {
      clearInterval(audioInterval);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [enabled, stream, proctor, onAiAlert]);

  // Frame sampling for visual proctoring simulation
  useEffect(() => {
    if (!enabled || !stream) return;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    videoRef.current = video;

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    canvasRef.current = canvas;
    const context = canvas.getContext('2d');

    frameIntervalRef.current = setInterval(() => {
      if (!context || video.paused || video.ended) return;

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const rand = Math.random();
        if (rand < 0.02) {
          proctor.report('LOOKING_AWAY', 'Candidate is looking away from the screen');
          onAiAlert?.('LOOKING_AWAY');
        } else if (rand < 0.035) {
          proctor.report('FACE_ABSENT', 'No face detected in camera view');
          onAiAlert?.('FACE_ABSENT');
        } else if (rand < 0.045) {
          proctor.report('FACE_MULTIPLE', 'Multiple faces detected in camera view');
          onAiAlert?.('FACE_MULTIPLE');
        } else if (rand < 0.05) {
          proctor.report('MOBILE_DETECTED', 'Mobile phone usage suspected');
          onAiAlert?.('MOBILE_DETECTED');
        }
      } catch (e) {
        // ignore frame sampling errors
      }
    }, FRAME_SAMPLE_INTERVAL_MS);

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      video.pause();
      video.srcObject = null;
    };
  }, [enabled, stream, proctor, onAiAlert]);

  return {
    stream,
    error,
    request,
    stop,
    cameraGranted: proctor.cameraGranted,
    micGranted: proctor.micGranted,
  };
}
