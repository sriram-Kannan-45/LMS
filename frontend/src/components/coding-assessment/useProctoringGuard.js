import { useEffect, useRef, useState, useCallback } from 'react';
import { API } from '../../api/api';
import { getAuthHeaders } from '../../api/request';

const GRACE_MS = 30000;

/**
 * Screen-share proctoring guard (Module D1).
 * Watches the shared MediaStream; if sharing stops, starts a 30s countdown
 * and auto-submits unless the participant re-shares in time.
 */
export default function useProctoringGuard({ attemptId, mediaStream, setMediaStream, onAutoSubmit }) {
  const [shareLost, setShareLost] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const intervalRef = useRef(null);

  const logViolation = useCallback(async (type, details) => {
    if (!attemptId) return;
    try {
      await fetch(API.CODING.VIOLATION(attemptId), {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details }),
      });
    } catch { /* best-effort */ }
  }, [attemptId]);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
  };

  const startCountdown = useCallback(() => {
    setShareLost(true);
    setCountdown(30);
    clearTimers();
    intervalRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    timerRef.current = setTimeout(() => { clearTimers(); onAutoSubmit?.('SCREEN_SHARE_TIMEOUT'); }, GRACE_MS);
  }, [onAutoSubmit]);

  const onScreenShareStopped = useCallback(() => {
    logViolation('SCREEN_SHARE_STOP', 'Screen sharing stopped during attempt');
    startCountdown();
  }, [logViolation, startCountdown]);

  const resumeScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      setMediaStream?.(stream);
      clearTimers();
      setShareLost(false);
      setCountdown(0);
      return true;
    } catch {
      return false; // user cancelled — countdown keeps running
    }
  }, [setMediaStream]);

  // Attach 'ended' listener to the current stream's video track.
  useEffect(() => {
    const track = mediaStream?.getVideoTracks?.()[0];
    if (!track) return;
    track.addEventListener('ended', onScreenShareStopped);
    return () => track.removeEventListener('ended', onScreenShareStopped);
  }, [mediaStream, onScreenShareStopped]);

  // Tab-switch violation logging (cheap extra signal).
  useEffect(() => {
    const onVis = () => { if (document.hidden) logViolation('TAB_SWITCH', 'Tab hidden'); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [logViolation]);

  useEffect(() => () => clearTimers(), []);

  return { shareLost, countdown, resumeScreenShare, logViolation };
}
