'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DashboardShell } from '@/components/DashboardShell';
import { getToken } from '@/lib/auth';
import { acquireInterviewMedia } from '@/lib/interviewMedia';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

interface SessionState {
  id: string;
  template: string;
  status: SessionStatus;
  startedAt: string;
  endsAt: string;
  serverNow: string;
  timeExpired: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: string | null;
  verdict: 'SELECT' | 'REJECT' | 'BORDERLINE' | null;
  overallScore: number | null;
  summaryJson: string | null;
  reportDetail: string | null;
}

interface SubmitAnswerResponse extends SessionState {
  lastTurn?: {
    score: number;
    feedback: string;
    keyPointsMissing: string[];
  };
  completed: boolean;
}

type Phase = 'intro' | 'preflight' | 'connecting' | 'live' | 'uploading' | 'finishing' | 'done' | 'disqualified' | 'error';
type InterviewMode = 'practice' | 'proctored';
type AwayReason = 'tab-hidden' | 'window-blur' | 'fullscreen-exit' | 'camera-stopped' | 'microphone-stopped' | 'screen-share-stopped' | 'prohibited-actions';

const AWAY_LIMIT_MS = 5000;

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export default function InterviewPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSpokenQuestionRef = useRef<string | null>(null);
  const preflightRunRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<number | null>(null);
  const awayStartedAtRef = useRef<number | null>(null);
  const awayReasonRef = useRef<AwayReason>('tab-hidden');
  const disqualifyingRef = useRef(false);
  const finishingRef = useRef(false);
  const violationCountRef = useRef(0);
  const lastViolationAtRef = useRef(0);

  const [phase, setPhase] = useState<Phase>('intro');
  const [mode, setMode] = useState<InterviewMode>('practice');
  const [resume, setResume] = useState<File | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [screenReady, setScreenReady] = useState(false);
  const [micDetected, setMicDetected] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const [speakerHeard, setSpeakerHeard] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [awaySeconds, setAwaySeconds] = useState(0);
  const [violations, setViolations] = useState(0);
  const [disqualifiedReason, setDisqualifiedReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [finishRetry, setFinishRetry] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [summaryParsed, setSummaryParsed] = useState<Record<string, unknown> | null>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [mediaNotices, setMediaNotices] = useState<string[]>([]);
  /** True when API returned 401 — show login link. */
  const [needRelogin, setNeedRelogin] = useState(false);
  /** Avoid hydration mismatch: `getToken()` is always null on the server. */
  const [hasMounted, setHasMounted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQuestionText, setShowQuestionText] = useState(false);

  const selectResume = (file: File | null) => {
    if (file && (file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf'))) {
      setError('Choose a PDF resume smaller than 5 MB.');
      setResume(null);
      return;
    }
    setError(null);
    setResume(file);
  };

  const syncTimer = useCallback((endsAt: string) => {
    const end = new Date(endsAt).getTime();
    setRemainingSec(Math.max(0, Math.floor((end - Date.now()) / 1000)));
  }, []);

  useEffect(() => {
    if (!session || session.status !== 'IN_PROGRESS') return;
    const tick = () => syncTimer(session.endsAt);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [session, syncTimer]);

  useEffect(() => {
    setHasMounted(true);
    setSpeechSupported('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  }, []);

  useEffect(() => {
    return () => {
      preflightRunRef.current += 1;
      if (meterTimerRef.current != null) window.clearInterval(meterTimerRef.current);
      void audioContextRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speakQuestion = useCallback(
    (question: string, force = false) => {
      if ((!voiceEnabled && !force) || !question) return;
      if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
        setSpeechSupported(false);
        setShowQuestionText(true);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(question);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        setShowQuestionText(true);
      };
      lastSpokenQuestionRef.current = question;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled],
  );

  useEffect(() => {
    const question = session?.currentQuestion;
    if (
      phase === 'live' &&
      voiceEnabled &&
      question &&
      lastSpokenQuestionRef.current !== question
    ) {
      speakQuestion(question);
    }
  }, [phase, session?.currentQuestion, speakQuestion, voiceEnabled]);

  useEffect(() => {
    const v = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!v || !stream || (phase !== 'preflight' && phase !== 'live' && phase !== 'uploading')) return;
    if (stream.getVideoTracks().length > 0) {
      v.srcObject = stream;
      void v.play().catch(() => undefined);
    } else {
      v.srcObject = null;
    }
  }, [phase, session?.id, hasVideoTrack]);

  const stopMedia = () => {
    if (meterTimerRef.current != null) window.clearInterval(meterTimerRef.current);
    meterTimerRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenReady(false);
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setHasVideoTrack(false);
    setVideoReady(false);
    setMicDetected(false);
    setMicLevel(0);
    setSoundPlayed(false);
    setSpeakerHeard(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const prepareProctored = async (selectedMicrophoneId = microphoneId, selectedCameraId = cameraId) => {
    setError(null);
    if (!getToken()) {
      setNeedRelogin(true);
      setError('Log in before starting the device checks.');
      setPhase('error');
      return;
    }
    const run = ++preflightRunRef.current;
    stopMedia();
    setPhase('preflight');
    try {
      const { stream, hasVideo } = await acquireInterviewMedia({
        microphoneId: selectedMicrophoneId || undefined,
        cameraId: selectedCameraId || undefined,
      });
      if (run !== preflightRunRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (!hasVideo) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('Proctored mode requires a working camera and microphone. Check permissions and try again.');
      }
      setVideoReady(false);
      mediaStreamRef.current = stream;
      setHasVideoTrack(true);
      const availableDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      if (run !== preflightRunRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setDevices(availableDevices);
      setMicDetected(false);
      setSoundPlayed(false);
      setSpeakerHeard(false);
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      meterTimerRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        const level = Math.sqrt(samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) / samples.length) / 128;
        setMicLevel(Math.min(100, Math.round(level * 500)));
        if (level > 0.015) setMicDetected(true);
      }, 150);
    } catch (e) {
      if (run !== preflightRunRef.current) return;
      stopMedia();
      setError(e instanceof Error ? e.message : 'Could not check your camera and microphone.');
    }
  };

  const playSpeakerTest = async () => {
    const context = audioContextRef.current;
    if (!context) return;
    try {
      await context.resume();
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.frequency.value = 440;
      volume.gain.value = 0.12;
      tone.connect(volume);
      volume.connect(context.destination);
      tone.start();
      tone.stop(context.currentTime + 0.4);
      setSoundPlayed(true);
    } catch {
      setError('Speaker test could not play. Check your audio output and try again.');
    }
  };

  const shareScreen = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('This browser does not support screen sharing. Use a recent Chrome or Edge browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface;
      if (surface !== 'monitor') {
        stream.getTracks().forEach((track) => track.stop());
        setError('Share your entire screen in a browser that reports the selected screen, not a tab or window.');
        return;
      }
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = stream;
      setScreenReady(true);
      setError(null);
    } catch {
      setError('Screen sharing was cancelled or blocked. Share your entire screen to continue.');
    }
  };

  useEffect(() => {
    if (mode !== 'proctored' || (phase !== 'live' && phase !== 'uploading') || session?.status !== 'IN_PROGRESS') return;

    const disqualify = (reason: AwayReason) => {
      if (disqualifyingRef.current) return;
      disqualifyingRef.current = true;
      setDisqualifiedReason(reason);
      setAwaySeconds(0);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
      stopMedia();
      setPhase('disqualified');
      const token = getToken();
      if (!token) {
        setError('Could not save disqualification: your login expired.');
        return;
      }
      void fetch(`${API_URL}/interview/sessions/${session.id}/disqualify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error('Could not save disqualification. Contact support.');
          const state = (await res.json()) as SessionState;
          setSession((current) => current?.id === session.id ? state : current);
        })
        .catch((cause: unknown) => {
          if (disqualifyingRef.current) setError(cause instanceof Error ? cause.message : 'Could not save disqualification.');
        });
    };

    const checkAway = () => {
      if (awayStartedAtRef.current === null) return;
      const elapsed = Date.now() - awayStartedAtRef.current;
      if (elapsed >= AWAY_LIMIT_MS) {
        disqualify(awayReasonRef.current);
      } else if (!document.hidden && document.hasFocus() && document.fullscreenElement) {
        awayStartedAtRef.current = null;
        setAwaySeconds(0);
      } else {
        setAwaySeconds(Math.ceil(elapsed / 1000));
      }
    };

    const markAway = (reason: AwayReason) => {
      if (awayStartedAtRef.current === null) {
        awayStartedAtRef.current = Date.now();
        awayReasonRef.current = reason;
      }
      checkAway();
    };

    const onVisibility = () => document.hidden ? markAway('tab-hidden') : checkAway();
    const onFocus = () => checkAway();
    const onBlur = () => markAway('window-blur');
    const onFullscreen = () => document.fullscreenElement ? checkAway() : markAway('fullscreen-exit');
    const videoTrack = mediaStreamRef.current?.getVideoTracks()[0];
    const audioTrack = mediaStreamRef.current?.getAudioTracks()[0];
    const onVideoEnded = () => disqualify('camera-stopped');
    const onAudioEnded = () => disqualify('microphone-stopped');
    const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
    const onScreenEnded = () => disqualify('screen-share-stopped');
    const onProhibited = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('main')) return;
      if (event.type === 'selectstart' && target.closest('input, textarea')) return;
      event.preventDefault();
      if (Date.now() - lastViolationAtRef.current < 1000) return;
      lastViolationAtRef.current = Date.now();
      violationCountRef.current += 1;
      setViolations(violationCountRef.current);
      if (violationCountRef.current >= 5) disqualify('prohibited-actions');
    };
    const onPageHide = () => {
      const token = getToken();
      if (!token || disqualifyingRef.current) return;
      void fetch(`${API_URL}/interview/sessions/${session.id}/disqualify`, {
        method: 'POST',
        keepalive: true,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'tab-hidden' }),
      }).catch(() => undefined);
    };
    const interval = window.setInterval(checkAway, 250);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);
    for (const eventName of ['copy', 'cut', 'paste', 'contextmenu', 'selectstart']) {
      document.addEventListener(eventName, onProhibited);
    }
    videoTrack?.addEventListener('ended', onVideoEnded);
    audioTrack?.addEventListener('ended', onAudioEnded);
    screenTrack?.addEventListener('ended', onScreenEnded);
    if (document.hidden) markAway('tab-hidden');
    else if (!document.fullscreenElement) markAway('fullscreen-exit');
    else if (!document.hasFocus()) markAway('window-blur');
    if (videoTrack?.readyState !== 'live') onVideoEnded();
    else if (audioTrack?.readyState !== 'live') onAudioEnded();
    else if (screenTrack?.readyState !== 'live') onScreenEnded();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
      for (const eventName of ['copy', 'cut', 'paste', 'contextmenu', 'selectstart']) {
        document.removeEventListener(eventName, onProhibited);
      }
      videoTrack?.removeEventListener('ended', onVideoEnded);
      audioTrack?.removeEventListener('ended', onAudioEnded);
      screenTrack?.removeEventListener('ended', onScreenEnded);
    };
  }, [mode, phase, session?.id, session?.status]);

  useEffect(() => {
    if ((phase === 'done' || phase === 'error' || phase === 'disqualified') && document.fullscreenElement) {
      void document.exitFullscreen();
    }
  }, [phase]);

  const startInterview = async () => {
    setError(null);
    setNeedRelogin(false);
    const token = getToken();
    if (!token) {
      setNeedRelogin(true);
      setError('You are not logged in.');
      setPhase('error');
      return;
    }

    if (mode === 'proctored') {
          if (!resume || !mediaStreamRef.current?.active || !hasVideoTrack || !videoReady || !micDetected || !speakerHeard || !screenReady ||
            screenStreamRef.current?.getVideoTracks()[0]?.readyState !== 'live' ||
          mediaStreamRef.current.getVideoTracks()[0]?.readyState !== 'live' ||
          mediaStreamRef.current.getAudioTracks()[0]?.readyState !== 'live') {
        setError('Upload a resume and complete the camera, microphone, speaker, and screen-share checks.');
        return;
      }
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        setError('Allow fullscreen to start a proctored interview.');
        return;
      }
    }

    setPhase('connecting');
    setMediaNotices([]);
    let createdSessionId: string | null = null;
    try {
      // Validate JWT with the API before asking for mic/camera (clearer errors, no wasted prompts).
      const formData = new FormData();
      formData.append('mode', mode === 'proctored' ? 'PROCTORED' : 'PRACTICE');
      if (resume) formData.append('resume', resume);
      const res = await fetch(`${API_URL}/interview/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as SessionState & { error?: string };

      if (res.status === 401) {
        setNeedRelogin(true);
        throw new Error(
          'Your session is invalid or expired. Log in again. If you recently changed JWT_SECRET in apps/api/.env, old tokens no longer work.',
        );
      }

      if (!res.ok) {
        throw new Error(data.error || `Could not start session (${res.status})`);
      }

      createdSessionId = data.id;

      if (mode === 'practice') {
        const { stream, hasVideo, notices } = await acquireInterviewMedia();
        mediaStreamRef.current = stream;
        setHasVideoTrack(hasVideo);
        setMediaNotices(notices);
      } else if (!document.fullscreenElement) {
        throw new Error('Fullscreen ended before the proctored interview started.');
      }

      if (meterTimerRef.current != null) window.clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;

      setSession(data);
      finishingRef.current = false;
      violationCountRef.current = 0;
      lastViolationAtRef.current = 0;
      setViolations(0);
      syncTimer(data.endsAt);
      setPhase('live');
      setLastFeedback(null);
      setTextAnswer('');
      setShowQuestionText(false);
      lastSpokenQuestionRef.current = null;
    } catch (e) {
      stopMedia();
      if (mode === 'proctored' && createdSessionId) {
        void fetch(`${API_URL}/interview/sessions/${createdSessionId}/disqualify`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'fullscreen-exit' }),
        }).catch(() => undefined);
      }
      if (mode === 'proctored' && document.fullscreenElement) void document.exitFullscreen();
      setHasVideoTrack(false);
      setMediaNotices([]);
      const msg = e instanceof Error ? e.message : 'Failed to start interview';
      setError(msg);
      setPhase('error');
    }
  };

  const startRecording = () => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    const audioOnly = new MediaStream(stream.getAudioTracks());
    chunksRef.current = [];
    const mime = pickRecorderMime();
    const rec = mime
      ? new MediaRecorder(audioOnly, { mimeType: mime })
      : new MediaRecorder(audioOnly);

    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    recorderRef.current = rec;
    rec.start(200);
    setIsRecording(true);
  };

  const stopRecording = (): Promise<Blob | null> => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec || rec.state === 'inactive') {
      setIsRecording(false);
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      rec.onstop = () => {
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        chunksRef.current = [];
        resolve(blob.size > 0 ? blob : null);
      };
      rec.stop();
    });
  };

  const submitAnswer = async () => {
    const token = getToken();
    if (!token || !session?.id) return;

    setPhase('uploading');
    setError(null);

    try {
      const blob = await stopRecording();
      if (disqualifyingRef.current) return;

      const trimmed = textAnswer.trim();
      if ((!blob || blob.size === 0) && !trimmed) {
        setPhase('live');
        setError('Record an answer or type a transcript below.');
        return;
      }

      const formData = new FormData();
      if (blob && blob.size > 0) {
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
        formData.append('audio', blob, `answer.${ext}`);
      }
      if (trimmed) {
        formData.append('transcript', trimmed);
      }

      const res = await fetch(`${API_URL}/interview/sessions/${session.id}/answers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as SubmitAnswerResponse & { error?: string };
      if (disqualifyingRef.current) return;
      if (res.status === 401) {
        setNeedRelogin(true);
        setError(
          'Your session expired. Log in again — you will need to start a new interview session.',
        );
        setPhase('live');
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }

      setSession(data);
      setTextAnswer('');
      if (data.lastTurn) {
        setLastFeedback(`${data.lastTurn.feedback} (score ${data.lastTurn.score}/10)`);
      }

      if (data.completed || data.status === 'COMPLETED') {
        stopMedia();
        if (data.summaryJson) {
          try {
            setSummaryParsed(JSON.parse(data.summaryJson) as Record<string, unknown>);
          } catch {
            setSummaryParsed(null);
          }
        }
        setPhase('done');
      } else {
        syncTimer(data.endsAt);
        setPhase('live');
      }
    } catch (e) {
      if (disqualifyingRef.current) return;
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg);
      setPhase('live');
    }
  };

  useEffect(() => {
    if (phase !== 'live' || session?.status !== 'IN_PROGRESS' || remainingSec > 0 || finishingRef.current || disqualifyingRef.current) return;
    finishingRef.current = true;
    setPhase('finishing');
    const token = getToken();
    if (!token) {
      setError('Log in again to finish and view your report.');
      setPhase('live');
      return;
    }
    void fetch(`${API_URL}/interview/sessions/${session.id}/finish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as SessionState & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not prepare your report.');
      setSession(data);
      if (data.summaryJson) {
        try { setSummaryParsed(JSON.parse(data.summaryJson) as Record<string, unknown>); }
        catch { setSummaryParsed(null); }
      }
      stopMedia();
      setPhase('done');
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Could not prepare your report.');
      setPhase('live');
    });
  }, [phase, remainingSec, session?.id, session?.status, finishRetry]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const verdictLabel = session?.verdict === 'SELECT'
    ? (session.overallScore != null && session.overallScore >= 85 ? 'Strong Hire' : 'Hire')
    : session?.verdict === 'BORDERLINE' ? 'Needs another round' : session?.verdict === 'REJECT' ? 'Not recommended yet' : '—';

  const copyReportToClipboard = async () => {
    if (!session?.reportDetail && !session?.summaryJson) return;
    const parts: string[] = [];
    if (session.summaryJson) {
      parts.push('Summary (JSON):\n' + session.summaryJson);
    }
    if (session.reportDetail) {
      parts.push('\n---\n\n' + session.reportDetail);
    }
    try {
      await navigator.clipboard.writeText(parts.join('\n'));
    } catch {
      /* ignore */
    }
  };

  if (phase === 'done' && session?.status === 'COMPLETED') {
    return (
      <DashboardShell mainClassName="p-6 md:p-10 max-w-3xl mx-auto">
        <Link
          href="/learn"
          className="text-sm text-[#22c55e] hover:underline mb-6 inline-block"
        >
          Back to dashboard
        </Link>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyReportToClipboard()}
            className="rounded-lg border border-[var(--border-theme)] bg-white px-3 py-1.5 text-sm text-[var(--text-theme)] hover:bg-green-50"
          >
            Copy report to clipboard
          </button>
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-theme)] mb-2">{mode === 'proctored' ? 'Interview report' : 'Practice feedback'}</h1>
        <p className="text-[var(--text-muted)] mb-6">
          {mode === 'proctored' && <>Verdict: <span className="text-[var(--text-theme)] font-medium">{verdictLabel}</span></>}
          {session.overallScore != null && (
            <span className={mode === 'proctored' ? 'ml-2' : ''}>Overall score: {session.overallScore}/100</span>
          )}
        </p>

        {summaryParsed && (
          <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-4 mb-6 text-[var(--text-theme)] text-sm space-y-3">
            {summaryParsed.dimensions && typeof summaryParsed.dimensions === 'object' && !Array.isArray(summaryParsed.dimensions) ? (
              <div>
                <h2 className="mb-2 font-semibold text-green-700">Skill analysis</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(summaryParsed.dimensions).map(([skill, score]) => (
                    <div key={skill} className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-2">
                      <span className="font-medium">{skill}</span>
                      {typeof score === 'number' && <span className="float-right font-semibold text-green-700">{Math.round(score)}/100</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {Array.isArray(summaryParsed.strengths) && summaryParsed.strengths.length > 0 && (
              <div>
                <div className="font-semibold text-green-700 mb-1">Strengths</div>
                <ul className="list-disc pl-5">
                  {(summaryParsed.strengths as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(summaryParsed.resumeSkillGaps) && summaryParsed.resumeSkillGaps.length > 0 && (
              <div>
                <div className="font-semibold text-amber-800 mb-1">Resume skill gaps</div>
                <ul className="list-disc pl-5">
                  {(summaryParsed.resumeSkillGaps as string[]).map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              </div>
            )}
            {(!Array.isArray(summaryParsed.resumeSkillGaps) || summaryParsed.resumeSkillGaps.length === 0) && Array.isArray(summaryParsed.weakTopics) && summaryParsed.weakTopics.length > 0 && (
              <div>
                <div className="font-semibold text-amber-800 mb-1">Topics to strengthen</div>
                <ul className="list-disc pl-5">
                  {(summaryParsed.weakTopics as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(summaryParsed.improvementPlan) && summaryParsed.improvementPlan.length > 0 && (
              <div>
                <div className="font-semibold text-sky-700 mb-1">Improvement plan</div>
                <ul className="list-disc pl-5">
                  {(summaryParsed.improvementPlan as string[]).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {session.reportDetail && (
          <div>
            <h2 className="text-lg font-medium text-[var(--text-theme)] mb-2">Skill gap analysis</h2>
            <div className="space-y-3 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-4 text-sm leading-relaxed text-[var(--text-theme)] [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.reportDetail}</ReactMarkdown>
            </div>
          </div>
        )}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName={`p-6 md:p-10 mx-auto ${phase === 'preflight' ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <Link href="/learn" className="text-sm text-green-700 hover:underline mb-6 inline-block">
        Back to dashboard
      </Link>

      <h1 className="font-nav-brand text-2xl font-semibold text-[var(--text-theme)] mb-2">
        {phase === 'intro' ? (resume ? 'Resume discussion mock interview' : 'Mock interview') : `${mode === 'proctored' ? 'Proctored' : 'Practice'} interview`} (10 min)
      </h1>
      <p className="text-[var(--text-muted)] text-sm mb-6">
        Each problem is spoken aloud and adapts to your answer. Camera video stays in this browser and is not uploaded.
        {mode === 'proctored' ? ' Stay in this tab and fullscreen; leaving for more than 5 seconds disqualifies the session.' : ' Camera access is optional in practice.'}
      </p>

      {phase === 'intro' && (
        <div className="mb-6 max-w-xl space-y-6">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--text-theme)]">Add your resume {mode === 'practice' && <span className="text-sm font-normal text-[var(--text-muted)]">(optional)</span>}</h2>
            <input
              id="interview-resume"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => selectResume(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
            <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectResume(event.dataTransfer.files[0] ?? null); }} className="rounded-lg border border-dashed border-green-300 bg-[var(--surface-panel)] p-6 text-center transition hover:border-green-500 hover:bg-green-50">
              <label htmlFor="interview-resume" className="block cursor-pointer text-sm font-semibold text-green-800">
                {resume ? resume.name : 'Choose a PDF resume'}
              </label>
              <p className="mt-1 text-xs text-[var(--text-muted)]">PDF · up to 5 MB</p>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Resume text is used to tailor questions. Only a skills and projects summary is kept with the interview.</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--text-theme)]">Select interview mode</h2>
            <div className="inline-flex rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-1" role="group" aria-label="Interview mode">
              {(['practice', 'proctored'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${mode === option ? 'bg-green-700 text-white' : 'text-[var(--text-muted)] hover:bg-white'}`}
                >
                  {option === 'practice' ? 'Practice' : 'Proctored'}
                </button>
              ))}
            </div>
          </section>
          {mode === 'proctored' && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-[var(--text-theme)]">
              <h2 className="font-semibold">Proctored interview requirements</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                <li>Allow camera and microphone access, confirm audio playback, and share your entire screen.</li>
                <li>Stay in this tab and fullscreen. A switch lasting more than five seconds disqualifies the session.</li>
                <li>Closing the tab or disconnecting a required device ends the proctored session.</li>
                <li>Copy/paste, right-click, and selecting page text are blocked; five attempts disqualify the session.</li>
              </ul>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      )}

      {(phase === 'live' || phase === 'uploading') && (
        <>
          {hasVideoTrack ? (
            <video
              ref={videoRef}
              onLoadedData={() => setVideoReady(true)}
              className="mb-4 w-full max-w-md rounded-lg border border-[var(--border-theme)] bg-black aspect-video object-cover"
              muted
              playsInline
            />
          ) : (
            <div
              className="mb-4 flex w-full max-w-md aspect-video items-center justify-center rounded-lg border border-dashed border-[var(--border-theme)] bg-[var(--surface-panel)] px-4 text-center text-sm text-[var(--text-muted)]"
              role="status"
            >
              Audio-only mode: microphone is active. Camera was skipped or unavailable.
            </div>
          )}
        </>
      )}
      {hasMounted && phase === 'intro' && !getToken() && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You must be logged in.{' '}
          <Link href="/sign-in?redirect_url=%2Finterview" className="font-medium text-green-700 underline">
            Go to login
          </Link>
        </div>
      )}

      {phase === 'intro' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => void (mode === 'proctored' ? prepareProctored() : startInterview())}
            disabled={mode === 'proctored' && !resume}
            className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mode === 'proctored' ? 'Check devices' : 'Start practice'}
          </button>
        </div>
      )}

      {phase === 'preflight' && (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)]">
            {hasVideoTrack ? (
              <video ref={videoRef} onLoadedData={() => setVideoReady(true)} className="aspect-video w-full bg-black object-cover" muted playsInline />
            ) : (
              <div className="flex aspect-video items-center justify-center p-4 text-center text-sm text-[var(--text-muted)]">Waiting for camera permission…</div>
            )}
          </div>
        <div className="space-y-4 rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-5">
          <h2 className="font-semibold text-[var(--text-theme)]">Device checks</h2>
          {devices.some((device) => device.kind === 'audioinput') && (
            <label className="block text-sm text-[var(--text-theme)]">Microphone input
              <select value={microphoneId} onChange={(event) => { setMicrophoneId(event.target.value); void prepareProctored(event.target.value, cameraId); }} className="mt-1 block w-full rounded-md border border-[var(--border-theme)] bg-white px-3 py-2 text-sm">
                <option value="">System default</option>
                {devices.filter((device) => device.kind === 'audioinput').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
              </select>
            </label>
          )}
          {devices.some((device) => device.kind === 'videoinput') && (
            <label className="block text-sm text-[var(--text-theme)]">Camera input
              <select value={cameraId} onChange={(event) => { setCameraId(event.target.value); void prepareProctored(microphoneId, event.target.value); }} className="mt-1 block w-full rounded-md border border-[var(--border-theme)] bg-white px-3 py-2 text-sm">
                <option value="">System default</option>
                {devices.filter((device) => device.kind === 'videoinput').map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
              </select>
            </label>
          )}
          <p className="text-sm text-[var(--text-muted)]">Camera: {videoReady ? 'live preview ready' : 'checking…'}</p>
          <div>
            <p className="text-sm text-[var(--text-muted)]">Microphone: {micDetected ? 'heard you' : 'speak to test'}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-green-100">
              <div className="h-full bg-green-700" style={{ width: `${micLevel}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void playSpeakerTest()} disabled={!hasVideoTrack} className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-50">
              Play speaker test
            </button>
            <label className="flex items-center gap-2 text-sm text-[var(--text-theme)]">
              <input type="checkbox" checked={speakerHeard} disabled={!soundPlayed} onChange={(event) => setSpeakerHeard(event.target.checked)} />
              I heard the tone
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void shareScreen()} className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">Share entire screen</button>
            <span className={`text-sm ${screenReady ? 'text-green-700' : 'text-[var(--text-muted)]'}`}>{screenReady ? 'Screen sharing active' : 'Not shared'}</span>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => { preflightRunRef.current += 1; stopMedia(); setHasVideoTrack(false); setVideoReady(false); setPhase('intro'); setError(null); }} className="rounded-md border border-[var(--border-theme)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-theme)]">Cancel</button>
            <button type="button" onClick={() => void startInterview()} disabled={!resume || !hasVideoTrack || !videoReady || !micDetected || !speakerHeard || !screenReady} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Begin proctored interview</button>
          </div>
        </div>
        </div>
      )}

      {(phase === 'connecting' || phase === 'uploading' || phase === 'finishing') && (
        <p className="text-[var(--text-muted)]">{phase === 'connecting' ? 'Connecting…' : phase === 'finishing' ? 'Preparing skill gap report…' : 'Submitting answer…'}</p>
      )}

      {phase === 'live' && session && (
        <div className="space-y-4">
          {mode === 'proctored' && (
            <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${awayStartedAtRef.current !== null ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}>
              {awayStartedAtRef.current !== null ? `Return to this tab and fullscreen now. ${Math.max(0, 5 - awaySeconds)}s left.` : 'Proctored session active · fullscreen and tab monitored'}
              {violations > 0 && <span className="ml-2 font-semibold">Prohibited actions: {violations}/5</span>}
              {awayStartedAtRef.current !== null && !document.fullscreenElement && (
                <button type="button" onClick={() => void document.documentElement.requestFullscreen().catch(() => setError('Allow fullscreen to continue.'))} className="ml-3 font-semibold underline">Return to fullscreen</button>
              )}
            </p>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          {mediaNotices.length > 0 && (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="status"
            >
              {mediaNotices.map((n) => (
                <p key={n} className="mb-1 last:mb-0">
                  {n}
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span
              className={
                remainingSec <= 60 ? 'text-red-700 font-semibold' : 'text-[var(--text-theme)]'
              }
            >
              Time left: {formatTime(remainingSec)}
            </span>
            <span className="text-[var(--text-muted)]">
              Question {session.currentQuestionIndex + 1} / {session.totalQuestions}
            </span>
          </div>

          {(session.timeExpired || remainingSec === 0) && (
            <div className="space-y-2">
              <p className="text-amber-800 text-sm">Time is up — you cannot submit more answers.</p>
              {error && <button type="button" onClick={() => { finishingRef.current = false; setError(null); setFinishRetry((value) => value + 1); }} className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-2 text-sm font-semibold text-green-700">Retry report</button>}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border-theme)] bg-[var(--surface-panel)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex min-h-10 flex-1 items-center gap-3 text-sm text-[var(--text-theme)]"
                role="status"
                aria-label={isSpeaking ? 'Problem is being spoken' : 'Audio problem ready'}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    isSpeaking ? 'animate-pulse bg-green-700' : 'bg-green-200'
                  }`}
                />
                {isSpeaking ? 'Playing problem…' : 'Audio problem ready'}
              </div>
              <button
                type="button"
                onClick={() => session.currentQuestion && speakQuestion(session.currentQuestion, true)}
                disabled={!session.currentQuestion || !speechSupported}
                className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-1.5 text-xs text-[var(--text-theme)] hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Replay
              </button>
              <button
                type="button"
                onClick={() => {
                  const enabled = !voiceEnabled;
                  setVoiceEnabled(enabled);
                  if (!enabled) {
                    window.speechSynthesis?.cancel();
                    setIsSpeaking(false);
                  } else if (session.currentQuestion) {
                    speakQuestion(session.currentQuestion, true);
                  }
                }}
                className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-1.5 text-xs text-[var(--text-theme)] hover:bg-green-50"
              >
                Voice {voiceEnabled ? 'on' : 'off'}
              </button>
              <button
                type="button"
                onClick={() => setShowQuestionText((shown) => !shown)}
                className="rounded-md border border-[var(--border-theme)] bg-white px-3 py-1.5 text-xs text-[var(--text-theme)] hover:bg-green-50"
              >
                {showQuestionText ? 'Hide' : 'Show'} transcript
              </button>
            </div>
            {(!speechSupported || showQuestionText) && (
              <p className="mt-3 border-t border-[var(--border-theme)] pt-3 text-sm leading-relaxed text-[var(--text-theme)]">
                {session.currentQuestion}
              </p>
            )}
            {!speechSupported && (
              <p className="mt-2 text-xs text-amber-800">
                Speech playback is unavailable in this browser, so the transcript is shown.
              </p>
            )}
          </div>

          {lastFeedback && (
            <p className="text-xs text-[var(--text-muted)] border-l-2 border-green-700 pl-2">Previous: {lastFeedback}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {!session.timeExpired && remainingSec > 0 && (
              <>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="rounded-lg border border-[var(--border-theme)] bg-white px-4 py-2 text-sm text-[var(--text-theme)] hover:bg-green-50"
                  >
                    Record answer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submitAnswer()}
                    className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-black hover:bg-[#1ea34a]"
                  >
                    Stop & submit
                  </button>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="interview-transcript" className="block text-xs text-[var(--text-muted)] mb-1">
              Optional: type transcript instead (or to supplement audio)
            </label>
            <textarea
              id="interview-transcript"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={session.timeExpired || remainingSec === 0}
              rows={4}
              className="w-full rounded border border-[var(--border-theme)] bg-white px-3 py-2 text-sm text-[var(--text-theme)] placeholder:text-[var(--text-muted)]"
              placeholder="If you prefer not to use the mic, paste your answer here and submit."
            />
            {!session.timeExpired && remainingSec > 0 && !isRecording && textAnswer.trim() && (
              <button
                type="button"
                onClick={() => void submitAnswer()}
                className="mt-2 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-black hover:bg-[#1ea34a]"
              >
                Submit typed answer
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error || 'Something went wrong.'}
          {needRelogin && (
            <div className="mt-3 space-y-2 text-[var(--text-theme)]">
              <Link
                href="/sign-in?redirect_url=%2Finterview"
                className="inline-block rounded-lg bg-[#22c55e] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#1ea34a]"
              >
                Log in again
              </Link>
              <p className="text-xs text-[var(--text-muted)]">
                Use the same API URL as this app (<code className="text-[var(--text-theme)]">NEXT_PUBLIC_API_URL</code>
                ). Mismatched API or changed <code className="text-[var(--text-theme)]">JWT_SECRET</code> also causes this
                error until you log in again.
              </p>
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setPhase('intro');
                setError(null);
                setNeedRelogin(false);
              }}
              className="text-green-700 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {phase === 'disqualified' && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
          <h2 className="font-semibold">Interview disqualified</h2>
          <p className="mt-1 text-sm">
            {disqualifiedReason === 'prohibited-actions' ? 'Five prohibited actions were detected.' :
              disqualifiedReason === 'screen-share-stopped' ? 'Screen sharing was stopped.' :
              disqualifiedReason === 'camera-stopped' ? 'The camera was disconnected.' :
              disqualifiedReason === 'microphone-stopped' ? 'The microphone was disconnected.' :
                `${disqualifiedReason === 'fullscreen-exit' ? 'Fullscreen was exited' : disqualifiedReason === 'window-blur' ? 'The interview window lost focus' : 'The interview tab was hidden'} for more than 5 seconds.`}
          </p>
          {error && <p className="mt-2 text-sm">{error}</p>}
          <button type="button" onClick={() => { setSession(null); disqualifyingRef.current = false; awayStartedAtRef.current = null; violationCountRef.current = 0; setViolations(0); setDisqualifiedReason(null); setPhase('intro'); if (document.fullscreenElement) void document.exitFullscreen(); }} className="mt-4 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white">New interview</button>
        </div>
      )}
    </DashboardShell>
  );
}
