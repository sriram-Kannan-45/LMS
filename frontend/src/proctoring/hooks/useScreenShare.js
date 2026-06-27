/**
 * useScreenShare — request and monitor a screen-share stream via
 * navigator.mediaDevices.getDisplayMedia. Validates that the user
 * shared their entire screen (displaySurface === 'monitor') and
 * rejects tab/window-only shares.
 *
 *   const { stream, isSharing, request, stop, error } =
 *       useScreenShare({ onStop, onDenied, onInvalidShare });
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useScreenShare({ onStop, onDenied, onInvalidShare } = {}) {
  const [stream, setStream] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);
  const onStopRef = useRef(onStop);
  const onDeniedRef = useRef(onDenied);
  const onInvalidShareRef = useRef(onInvalidShare);

  useEffect(() => { onStopRef.current = onStop; }, [onStop]);
  useEffect(() => { onDeniedRef.current = onDenied; }, [onDenied]);
  useEffect(() => { onInvalidShareRef.current = onInvalidShare; }, [onInvalidShare]);

  const request = useCallback(async () => {
    setError(null);
    console.log('[useScreenShare] Requesting display media...');
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const e = new Error('Screen sharing is not supported in this browser');
      setError(e); onDeniedRef.current?.(e);
      return null;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });

      // Post-grant validation: verify the user shared the entire screen
      // or an application window. Reject browser tab shares only.
      const track = s.getVideoTracks()[0];
      let surface = track?.getSettings?.().displaySurface;
      // Firefox/Safari may not support getSettings().displaySurface — skip check
      if (surface && surface === 'browser') {
        s.getTracks().forEach(t => t.stop());
        const e = new Error('Please share your entire screen or an application window, not a browser tab.');
        setError(e);
        onInvalidShareRef.current?.(e);
        return null;
      }

      setStream(s);
      setIsSharing(true);
      console.log('[useScreenShare] Stream acquired, surface:', surface || 'unknown');

      // The user can stop sharing at any time via the browser UI.
      track.addEventListener('ended', () => {
        console.log('[useScreenShare] Track ended by user/browser');
        setIsSharing(false);
        setStream(null);
        onStopRef.current?.();
      });

      return s;
    } catch (err) {
      console.error('[useScreenShare] getDisplayMedia failed:', err);
      setError(err);
      onDeniedRef.current?.(err);
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsSharing(false);
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }, [stream]);

  return { stream, isSharing, request, stop, error };
}
