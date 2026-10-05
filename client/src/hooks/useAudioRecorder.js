/**
 * @module hooks/useAudioRecorder
 * @description Custom React hook managing the browser MediaRecorder lifecycle,
 * Web Audio API AnalyserNode frequency analysis, recording duration timer (10m cap),
 * and in-memory Blob caching for zero-loss transcription retries.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { AUDIO_CONSTANTS } from '../utils/constants.js';

/**
 * Formats a duration in seconds into 'mm:ss' display format.
 *
 * @function formatDuration
 * @param {number} seconds - Total elapsed seconds.
 * @returns {string} Formatted duration string (e.g., '00:14').
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Selects the optimal supported audio MIME type for the client browser.
 *
 * @function getSupportedAudioMimeType
 * @returns {string} Supported MIME type string or empty string for browser default.
 */
export const getSupportedAudioMimeType = () => {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }

  const preferredCandidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];

  for (const candidate of preferredCandidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return '';
};

/**
 * Custom React hook for live audio dictation recording.
 *
 * @function useAudioRecorder
 * @param {object} [options={}] - Hook options.
 * @param {number} [options.maxDurationSeconds=AUDIO_CONSTANTS.MAX_DURATION_SECONDS] - Maximum recording duration.
 * @param {number} [options.fftSize=64] - AnalyserNode FFT size for waveform frequency data.
 * @returns {{
 *   isRecording: boolean,
 *   isPaused: boolean,
 *   duration: number,
 *   formattedDuration: string,
 *   audioBlob: Blob|null,
 *   cachedAudioBlob: Blob|null,
 *   audioUrl: string|null,
 *   audioLevel: number,
 *   error: string|null,
 *   startRecording: () => Promise<boolean>,
 *   stopRecording: () => Promise<Blob|null>,
 *   pauseRecording: () => void,
 *   resumeRecording: () => void,
 *   cancelRecording: () => void,
 *   resetRecorder: () => void,
 *   clearCachedBlob: () => void,
 *   getFrequencyData: () => Uint8Array,
 * }} Audio recording state and controls.
 */
export const useAudioRecorder = (options = {}) => {
  const maxDurationSeconds =
    options.maxDurationSeconds || AUDIO_CONSTANTS.MAX_DURATION_SECONDS || 600;
  const fftSize = options.fftSize || 64;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [cachedAudioBlob, setCachedAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState(null);

  // Core audio references
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const animFrameRef = useRef(null);
  const isCancelledRef = useRef(false);
  const resolveStopPromiseRef = useRef(null);

  /**
   * Safely stops and cleans up audio hardware stream tracks.
   */
  const cleanupMediaTracks = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track termination errors
        }
      });
      mediaStreamRef.current = null;
    }
  }, []);

  /**
   * Safely cleans up Web Audio API nodes and context.
   */
  const cleanupAudioContext = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Node already disconnected
      }
      sourceNodeRef.current = null;
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // Node already disconnected
      }
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch {
        // Context already closed
      }
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  /**
   * Clears active duration tracking timer.
   */
  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  /**
   * Cancels active recording without producing a Blob.
   */
  const cancelRecording = useCallback(() => {
    isCancelledRef.current = true;
    clearTimer();
    cleanupAudioContext();

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore recorder stop error
      }
    }

    cleanupMediaTracks();
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setError(null);

    if (resolveStopPromiseRef.current) {
      resolveStopPromiseRef.current(null);
      resolveStopPromiseRef.current = null;
    }
  }, [clearTimer, cleanupAudioContext, cleanupMediaTracks]);

  /**
   * Stops recording and resolves with completed audio Blob.
   */
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      isCancelledRef.current = false;
      clearTimer();
      cleanupAudioContext();

      if (
        !mediaRecorderRef.current ||
        mediaRecorderRef.current.state === 'inactive'
      ) {
        setIsRecording(false);
        setIsPaused(false);
        cleanupMediaTracks();
        resolve(cachedAudioBlob || audioBlob || null);
        return;
      }

      resolveStopPromiseRef.current = resolve;

      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMediaTracks();
        setIsRecording(false);
        setIsPaused(false);
        resolve(null);
      }
    });
  }, [clearTimer, cleanupAudioContext, cleanupMediaTracks, cachedAudioBlob, audioBlob]);

  /**
   * Begins microphone stream acquisition and starts audio recording.
   */
  const startRecording = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const err = 'Audio recording is not supported in this browser environment.';
      setError(err);
      toast.error(err);
      return false;
    }

    // Reset previous recording states
    isCancelledRef.current = false;
    chunksRef.current = [];
    setError(null);
    setDuration(0);
    setAudioLevel(0);

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      let friendlyError = 'Failed to access microphone. Please try again.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyError = 'Microphone permission required.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyError = 'No microphone found on this device.';
      }
      setError(friendlyError);
      toast.error(friendlyError);
      return false;
    }

    mediaStreamRef.current = stream;

    // 1. Initialize Web Audio API AnalyserNode for live visual waveform
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tickAudioLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average energy level (0.0 to 1.0)
          let sum = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            sum += dataArray[i];
          }
          const avg = sum / (dataArray.length || 1);
          setAudioLevel(Math.min(1, avg / 128));

          animFrameRef.current = requestAnimationFrame(tickAudioLevel);
        };

        animFrameRef.current = requestAnimationFrame(tickAudioLevel);
      }
    } catch {
      // AnalyserNode is optional: voice recording continues even if AudioContext fails
    }

    // 2. Instantiate MediaRecorder with optimal MIME format
    const mimeType = getSupportedAudioMimeType();
    let recorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      // Fallback without mimeType option
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        cleanupMediaTracks();
        cleanupAudioContext();
        const err = 'Failed to initialize audio recorder.';
        setError(err);
        toast.error(err);
        return false;
      }
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      cleanupMediaTracks();
      cleanupAudioContext();
      setIsRecording(false);
      setIsPaused(false);

      if (isCancelledRef.current) {
        chunksRef.current = [];
        if (resolveStopPromiseRef.current) {
          resolveStopPromiseRef.current(null);
          resolveStopPromiseRef.current = null;
        }
        return;
      }

      const resolvedType = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: resolvedType });
      chunksRef.current = [];

      // Retain in-memory cache for zero-loss retry
      setAudioBlob(blob);
      setCachedAudioBlob(blob);

      if (typeof window !== 'undefined' && window.URL) {
        if (audioUrl) {
          window.URL.revokeObjectURL(audioUrl);
        }
        const newUrl = window.URL.createObjectURL(blob);
        setAudioUrl(newUrl);
      }

      if (resolveStopPromiseRef.current) {
        resolveStopPromiseRef.current(blob);
        resolveStopPromiseRef.current = null;
      }
    };

    recorder.start(250); // Collect slice every 250ms
    setIsRecording(true);
    setIsPaused(false);

    // 3. Start recording duration timer with 10-minute cap
    timerIntervalRef.current = setInterval(() => {
      setDuration((prev) => {
        const next = prev + 1;
        if (next >= maxDurationSeconds) {
          toast.info(`Maximum recording limit of ${Math.round(maxDurationSeconds / 60)} minutes reached.`);
          stopRecording();
          return maxDurationSeconds;
        }
        return next;
      });
    }, 1000);

    return true;
  }, [
    fftSize,
    maxDurationSeconds,
    audioUrl,
    cleanupMediaTracks,
    cleanupAudioContext,
    stopRecording,
  ]);

  /**
   * Pauses active audio recording.
   */
  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      try {
        mediaRecorderRef.current.pause();
        clearTimer();
        setIsPaused(true);
      } catch {
        // Ignore pause errors
      }
    }
  }, [clearTimer]);

  /**
   * Resumes paused audio recording.
   */
  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'paused'
    ) {
      try {
        mediaRecorderRef.current.resume();
        setIsPaused(false);

        timerIntervalRef.current = setInterval(() => {
          setDuration((prev) => {
            const next = prev + 1;
            if (next >= maxDurationSeconds) {
              toast.info(`Maximum recording limit of ${Math.round(maxDurationSeconds / 60)} minutes reached.`);
              stopRecording();
              return maxDurationSeconds;
            }
            return next;
          });
        }, 1000);
      } catch {
        // Ignore resume errors
      }
    }
  }, [maxDurationSeconds, stopRecording]);

  /**
   * Resets all recorder states and revokes object URL.
   */
  const resetRecorder = useCallback(() => {
    cancelRecording();
    setAudioBlob(null);
    setCachedAudioBlob(null);
    if (audioUrl && typeof window !== 'undefined' && window.URL) {
      window.URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
  }, [cancelRecording, audioUrl]);

  /**
   * Clears only cached audio blobs.
   */
  const clearCachedBlob = useCallback(() => {
    setAudioBlob(null);
    setCachedAudioBlob(null);
    if (audioUrl && typeof window !== 'undefined' && window.URL) {
      window.URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
  }, [audioUrl]);

  /**
   * Returns byte frequency data array for visual bar rendering.
   */
  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current) {
      return new Uint8Array(fftSize / 2);
    }
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, [fftSize]);

  // Cleanup on hook unmount
  useEffect(() => {
    return () => {
      clearTimer();
      cleanupAudioContext();
      cleanupMediaTracks();
      if (audioUrl && typeof window !== 'undefined' && window.URL) {
        window.URL.revokeObjectURL(audioUrl);
      }
    };
  }, [clearTimer, cleanupAudioContext, cleanupMediaTracks, audioUrl]);

  return {
    isRecording,
    isPaused,
    duration,
    formattedDuration: formatDuration(duration),
    audioBlob,
    cachedAudioBlob,
    audioUrl,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    resetRecorder,
    clearCachedBlob,
    getFrequencyData,
  };
};

export default useAudioRecorder;
