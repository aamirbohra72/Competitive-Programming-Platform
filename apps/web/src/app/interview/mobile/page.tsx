'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const STORAGE_KEY = 'interview-mobile-device';
type Check = { id: string; status: string; reason: string };

export default function MobileInterviewPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pairingTokenRef = useRef('');
  const captureRef = useRef('');
  const [deviceToken, setDeviceToken] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const [started, setStarted] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [warnings, setWarnings] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    pairingTokenRef.current = new URLSearchParams(window.location.hash.slice(1)).get('token') || pairingTokenRef.current;
    window.history.replaceState(null, '', window.location.pathname);
    return () => { streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const connect = async () => {
    if (!consent || busy) return;
    setBusy(true);
    setError('');
    let stream: MediaStream | null = null;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS. Open the secure mobile link.');
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: 'environment' }, width: { ideal: 960 }, height: { ideal: 540 },
      } });
      let token = sessionStorage.getItem(STORAGE_KEY) || '';
      if (pairingTokenRef.current) {
        const response = await fetch(`${API_URL}/interview/mobile/claim`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pairingTokenRef.current }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Pairing failed.');
        token = data.deviceToken;
        sessionStorage.setItem(STORAGE_KEY, token);
        pairingTokenRef.current = '';
      }
      if (!token) throw new Error('Scan a new QR code from your laptop.');
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera preview could not start.');
      video.srcObject = stream;
      await video.play();
      setDeviceToken(token);
      setReady(true);
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { setReady(false); setError('Camera stopped. Reconnect to avoid warnings.'); }, { once: true });
    } catch (cause) { stream?.getTracks().forEach((track) => track.stop()); setError(cause instanceof Error ? cause.message : 'Camera access failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!deviceToken || !ready || ended) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const video = videoRef.current;
        if (document.hidden || !video || video.readyState < 2 || streamRef.current?.getVideoTracks()[0]?.readyState !== 'live') throw new Error('Keep this camera page open and the camera running.');
        const response = await fetch(`${API_URL}/interview/mobile/heartbeat`, {
          method: 'POST', signal: controller.signal, headers: { Authorization: `Bearer ${deviceToken}` },
        });
        const data = await response.json();
        if (response.status === 410 || response.status === 401) {
          if (!cancelled) { setEnded(true); setReady(false); sessionStorage.removeItem(STORAGE_KEY); streamRef.current?.getTracks().forEach((track) => track.stop()); setError(response.status === 401 ? data.error : ''); }
          return;
        }
        if (!response.ok) throw new Error(data.error || 'Mobile monitoring unreachable.');
        if (cancelled) return;
        setStarted(data.started);
        setChecks(data.checks);
        setWarnings(data.warnings);
        setError('');
        if (data.captureId && captureRef.current !== data.captureId) {
          captureRef.current = data.captureId;
          const canvas = document.createElement('canvas');
          canvas.width = 960;
          canvas.height = Math.round(960 * video.videoHeight / video.videoWidth);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not capture the camera frame.');
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.65));
          if (!photo || photo.size > 512 * 1024) throw new Error('Could not capture a small enough photo.');
          const body = new FormData();
          body.append('captureId', data.captureId);
          body.append('photo', photo, 'check.jpg');
          const uploaded = await fetch(`${API_URL}/interview/mobile/photos`, {
            method: 'POST', body, signal: controller.signal, headers: { Authorization: `Bearer ${deviceToken}` },
          });
          const assessment = await uploaded.json();
          if (!uploaded.ok) { captureRef.current = ''; throw new Error(assessment.error || 'Photo upload failed.'); }
          if (!cancelled && assessment.status !== 'passed') setError(assessment.reason);
        }
      } catch (cause) {
        captureRef.current = '';
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Connection lost. Keep this page open.');
      } finally { if (!cancelled) timer = setTimeout(poll, 3000); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [deviceToken, ready, ended]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-[var(--surface-panel)] px-4 py-6 text-[var(--text-theme)]">
      <h1 className="font-nav-brand text-xl font-semibold">Interview mobile camera</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]" role="status">{ended ? 'Monitoring ended' : ready ? started ? 'Interview monitoring active' : 'Connected. Waiting for the laptop.' : 'Camera not connected'}</p>
      <video ref={videoRef} autoPlay muted playsInline className="mt-5 aspect-video w-full rounded-md bg-black object-contain" />
      {!ready && !ended && <section className="mt-5 space-y-4">
        <p className="text-sm">Position the phone to show you and your laptop. Keep this page visible for the entire interview.</p>
        <p className="text-sm">Three photos are captured at random times and sent to Groq to check that one person and a laptop are visible. This application does not store photos. Results and warnings are stored with your interview. Detection can be wrong and does not prove cheating or identity.</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />I consent to camera access and three photo assessments.</label>
        <button type="button" disabled={!consent || busy} onClick={() => void connect()} className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Connecting...' : 'Connect camera'}</button>
      </section>}
      {ready && <div className="mt-4 flex flex-wrap gap-4 text-sm"><span>Photos: {checks.length}/3</span><span>Warnings: {warnings}/4</span></div>}
      {checks.map((check) => <p key={check.id} className={`mt-3 text-sm ${check.status === 'passed' ? 'text-green-700' : 'text-amber-800'}`}>{check.reason}</p>)}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </main>
  );
}