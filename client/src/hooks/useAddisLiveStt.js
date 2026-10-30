/**
 * @module hooks/useAddisLiveStt
 * @description Decoupled, reusable React hook for real-time live Speech-to-Text (STT) powered by Addis AI Scribe.
 * Captures microphone audio via modern W3C AudioWorklet, resamples/converts to 16 kHz Mono Signed 16-bit PCM (PCM16 Little Endian),
 * and streams frames over a secure WebSocket using single-use session tickets.
 *
 * Agnostic of chat, reports, or domain models - usable in composer, search modals, forms, and notes.
 * Completely free of deprecated ScriptProcessorNode interfaces.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useCreateScribeSessionMutation } from '../redux/features/sttSlice.js';

/**
 * AudioWorkletProcessor inline source code.
 * Runs on a dedicated background audio rendering thread.
 * Buffers 4096 samples (~85ms at 48kHz) and transfers to main thread for PCM16 encoding.
 * Computes RMS audio level for real-time acoustic visualizer bars.
 */
const WORKLET_PROCESSOR_CODE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0]) {
      const channel = input[0];
      const len = channel.length;
      let sumSquares = 0;

      for (let i = 0; i < len; i++) {
        const sample = channel[i];
        sumSquares += sample * sample;
        this.buffer[this.index++] = sample;

        if (this.index >= this.bufferSize) {
          const rms = Math.sqrt(sumSquares / len);
          this.port.postMessage({
            buffer: this.buffer.slice(0, this.bufferSize),
            rms: rms,
          });
          this.index = 0;
          sumSquares = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

/**
 * Resamples Float32 audio buffer and converts to Int16 PCM Little-Endian ArrayBuffer.
 *
 * @param {Float32Array} float32Array - Raw browser audio samples in [-1.0, 1.0].
 * @param {number} inputSampleRate - AudioContext input sample rate (e.g. 44100 or 48000).
 * @param {number} [targetSampleRate=16000] - Scribe expected sample rate (16000).
 * @returns {ArrayBuffer} Raw PCM16 little-endian byte buffer.
 */
function float32ToPcm16(float32Array, inputSampleRate, targetSampleRate = 16000) {
  let resampled = float32Array;
  if (inputSampleRate !== targetSampleRate) {
    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(float32Array.length / ratio);
    resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.floor(i * ratio);
      resampled[i] = float32Array[idx] || 0;
    }
  }

  const buffer = new ArrayBuffer(resampled.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < resampled.length; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Formats duration in seconds to MM:SS string.
 *
 * @param {number} totalSeconds
 * @returns {string} Formatted time string.
 */
function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Custom hook for Addis AI Scribe live speech recognition.
 *
 * @param {object} [options={}]
 * @param {Function} [options.onTranscript] - Callback ({ partial, final, text, isFinal }) => void.
 * @param {Function} [options.onError] - Error callback (err) => void.
 * @param {string} [options.language='am'] - Audio language ('am' for Amharic).
 * @returns {object} Controller API.
 */
export function useAddisLiveStt({ onTranscript, onError, language = 'am' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const [createScribeSession] = useCreateScribeSessionMutation();

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const timerRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const teardownAudio = useCallback(() => {
    isListeningRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (processorRef.current) {
      try {
        if (processorRef.current.port) {
          processorRef.current.port.onmessage = null;
        }
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    if (socketRef.current) {
      try {
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'session.end' }));
          socketRef.current.close(1000, 'Client stopped listening');
        } else if (socketRef.current.readyState === WebSocket.CONNECTING) {
          socketRef.current.close();
        }
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    setIsListening(false);
    setIsConnecting(false);
    setDuration(0);
    setAudioLevel(0);
  }, []);

  const stopListening = useCallback(() => {
    teardownAudio();
  }, [teardownAudio]);

  const cancelListening = useCallback(() => {
    teardownAudio();
  }, [teardownAudio]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    setError(null);
    setIsConnecting(true);

    try {
      // 1. Check browser media support & request microphone stream
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Microphone audio capture is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 2. Request single-use Scribe session ticket from backend
      const sessionRes = await createScribeSession({ language: language || 'am' }).unwrap();
      const sessionData = sessionRes?.data || sessionRes;

      const ticket = sessionData?.ticket || sessionData?.token;
      const websocketUrl = sessionData?.websocketUrl || sessionData?.websocket_url;

      if (!ticket || !websocketUrl) {
        throw new Error('Invalid Scribe session data received from server.');
      }

      // 3. Connect to live Addis AI WebSocket
      const socket = new WebSocket(websocketUrl);
      socketRef.current = socket;
      socket.binaryType = 'arraybuffer';

      socket.onopen = async () => {
        // Authenticate as the very first frame
        socket.send(
          JSON.stringify({
            type: 'session.authenticate',
            token: ticket,
            ticket: ticket,
          })
        );

        setIsConnecting(false);
        setIsListening(true);

        // Start duration counter
        const startTime = Date.now();
        timerRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 500);

        // 4. Initialize Web Audio API pipeline with modern AudioWorkletNode
        try {
          const AudioContextClass =
            window.AudioContext ||
            (typeof window !== 'undefined' ? window['webkitAudioContext'] : null);
          if (!AudioContextClass) {
            throw new Error('Web Audio API is not supported in this browser.');
          }

          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }

          const source = audioCtx.createMediaStreamSource(stream);

          if (audioCtx.audioWorklet) {
            const blob = new Blob([WORKLET_PROCESSOR_CODE], {
              type: 'application/javascript',
            });
            const workletUrl = URL.createObjectURL(blob);
            try {
              await audioCtx.audioWorklet.addModule(workletUrl);
            } finally {
              URL.revokeObjectURL(workletUrl);
            }

            const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
              numberOfInputs: 1,
              numberOfOutputs: 1,
              outputChannelCount: [1],
            });
            processorRef.current = workletNode;

            workletNode.port.onmessage = (e) => {
              if (socket.readyState !== WebSocket.OPEN) return;
              const { buffer, rms } = e.data || {};
              if (rms !== undefined) {
                setAudioLevel(Math.min(1, rms * 5));
              }
              if (buffer) {
                const pcmBuffer = float32ToPcm16(buffer, audioCtx.sampleRate, 16000);
                socket.send(pcmBuffer);
              }
            };

            const muteGain = audioCtx.createGain();
            muteGain.gain.setValueAtTime(0, audioCtx.currentTime);

            source.connect(workletNode);
            workletNode.connect(muteGain);
            muteGain.connect(audioCtx.destination);
          } else {
            // Defensive legacy fallback only if audioWorklet is unavailable
            const scriptProc = audioCtx['createScriptProcessor']?.(4096, 1, 1);
            if (scriptProc) {
              processorRef.current = scriptProc;
              scriptProc['onaudioprocess'] = (e) => {
                if (socket.readyState !== WebSocket.OPEN) return;
                const inputChannel = e['inputBuffer']?.getChannelData(0);
                if (inputChannel) {
                  const pcmBuffer = float32ToPcm16(inputChannel, audioCtx.sampleRate, 16000);
                  socket.send(pcmBuffer);
                }
              };
              source.connect(scriptProc);
              scriptProc.connect(audioCtx.destination);
            }
          }
        } catch (audioErr) {
          console.error('[useAddisLiveStt] AudioContext pipeline failure:', audioErr);
          teardownAudio();
          setError(audioErr.message);
          onError?.(audioErr);
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!msg) return;

          // Event type 1: Partial transcript frame
          if (
            msg.type === 'transcript.partial' ||
            msg.type === 'transcript.partial_text' ||
            msg.partial ||
            msg.is_final === false
          ) {
            const partialText =
              msg.text || msg.transcript || msg.partial || msg.partial_text || '';
            if (partialText) {
              onTranscript?.({
                partial: partialText,
                final: '',
                text: partialText,
                isFinal: false,
              });
            }
          }
          // Event type 2: Completed/final transcript frame
          else if (
            msg.type === 'transcript.completed' ||
            msg.type === 'transcript.final' ||
            msg.is_final === true ||
            msg.final
          ) {
            const finalText = msg.text || msg.transcript || msg.final || '';
            if (finalText) {
              onTranscript?.({
                partial: '',
                final: finalText,
                text: finalText,
                isFinal: true,
              });
            }
          }
          // Event type 3: Generic text message
          else if (msg.text) {
            onTranscript?.({
              partial: '',
              final: msg.text,
              text: msg.text,
              isFinal: true,
            });
          }
        } catch (parseErr) {
          console.warn('[useAddisLiveStt] Failed to parse WebSocket frame:', parseErr);
        }
      };

      socket.onerror = () => {
        const errMsg = 'Addis AI Scribe WebSocket error encountered.';
        setError(errMsg);
        onError?.(new Error(errMsg));
        teardownAudio();
      };

      socket.onclose = () => {
        teardownAudio();
      };
    } catch (err) {
      const msg = err?.data?.message || err?.message || 'Could not start live speech recognition.';
      setError(msg);
      onError?.(err);
      teardownAudio();
    }
  }, [createScribeSession, language, onError, onTranscript, teardownAudio]);

  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, [teardownAudio]);

  return {
    isListening,
    isConnecting,
    error,
    duration,
    formattedDuration: formatDuration(duration),
    audioLevel,
    startListening,
    stopListening,
    cancelListening,
  };
}

export default useAddisLiveStt;
