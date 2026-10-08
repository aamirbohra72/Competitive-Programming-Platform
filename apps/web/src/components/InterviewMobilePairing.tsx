'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getToken } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
type Check = { id: string; status: string; reason: string };
export interface MobileMonitorStatus {
  connected: boolean; started: boolean; checks: Check[]; warnings: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}

export function InterviewMobilePairing({ sessionId, live, onStart, onStatus }: {
  sessionId: string; live: boolean; onStart: () => Promise<void>;
  onStatus: (status: MobileMonitorStatus) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<MobileMonitorStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!link || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, link, { width: 224, margin: 2, errorCorrectionLevel: 'M' })
      .catch(() => setError('Could not generate the QR code.'));
  }, [link]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const token = getToken();
        if (!token) throw new Error('Log in again to check mobile monitoring.');
        const response = await fetch(`${API_URL}/interview/sessions/${sessionId}/mobile`, {
          cache: 'no-store', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not check the mobile camera.');
        if (!cancelled) {
          setStatus(data);
          setError('');
          onStatusRef.current(data);
          setExpired(Boolean(expiresAt && Date.now() > new Date(expiresAt).getTime()));
        }
      } catch (cause) {
        if (!cancelled) { setStatus(null); setError(cause instanceof Error ? cause.message : 'Mobile camera unreachable.'); }
      } finally { if (!cancelled) timer = setTimeout(poll, 3000); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId, expiresAt]);

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/interview/sessions/${sessionId}/mobile/pair`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not pair the mobile camera.');
      const origin = process.env.NEXT_PUBLIC_MOBILE_ORIGIN || window.location.origin;
      setLink(`${origin.replace(/\/$/, '')}/interview/mobile#token=${encodeURIComponent(data.token)}`);
      setExpiresAt(data.expiresAt);
      setExpired(false);
      setStatus(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pairing failed.'); }
    finally { setBusy(false); }
  };

  if (live) return (
    <section aria-label="Mobile monitoring" className="shrink-0 border-b border-[var(--border-theme)] py-2 text-xs text-[var(--text-theme)]">
      <div className="flex flex-wrap gap-x-4 gap-y-1" role="status">
        <span className={status?.connected ? 'text-green-700' : 'text-amber-800'}>Mobile camera: {status?.connected ? 'connected' : 'reconnecting'}</span>
        <span>Photos: {status?.checks.filter((check) => check.status !== 'processing').length ?? 0}/3</span>
        <span>Proctoring warnings: {status?.warnings ?? 0}/4</span>
      </div>
      {status?.checks.filter((check) => check.status !== 'passed' && check.status !== 'processing').map((check) => <p key={check.id} className="mt-1 text-amber-800">{check.reason}</p>)}
      {error && <p role="alert" className="mt-1 text-red-700">{error}</p>}
    </section>
  );

  return (
    <section className="my-5 border-y border-[var(--border-theme)] py-5" aria-labelledby="mobile-pairing-title">
      <h2 id="mobile-pairing-title" className="text-base font-semibold text-[var(--text-theme)]">Connect mobile camera</h2>
      <div className="mt-4 grid items-start gap-5 sm:grid-cols-[224px_minmax(0,1fr)]">
        <div className="flex h-56 w-56 items-center justify-center bg-white">
          {link ? <canvas ref={canvasRef} width={224} height={224} role="img" aria-label="Scan to pair your phone camera" /> : <span className="px-4 text-center text-sm text-gray-600">QR code not generated</span>}
        </div>
        <div className="min-w-0 space-y-3 text-sm text-[var(--text-theme)]">
          <p>Place your phone to the side with you and your laptop visible. Keep the camera page open throughout the interview.</p>
          <p>Three photos will be taken at random times and sent to Groq for visibility checks. Photos are not stored by this application. Four combined proctoring warnings disqualify the interview.</p>
          <p role="status" className={status?.connected ? 'font-semibold text-green-700' : 'text-amber-800'}>{status?.connected ? 'Mobile camera connected' : expired ? 'QR code expired' : 'Waiting for mobile camera'}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void generate()} disabled={busy} className="rounded-md border border-[var(--border-theme)] px-3 py-2 font-semibold disabled:opacity-50">{busy ? 'Generating...' : link ? 'Replace QR code' : 'Generate QR code'}</button>
            <button type="button" disabled={busy || !status?.connected || expired} onClick={() => { setBusy(true); void onStart().catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not start interview.')).finally(() => setBusy(false)); }} className="rounded-md bg-green-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Start interview</button>
          </div>
          {link && <a href={link} className="inline-block text-green-700 underline">Open mobile camera link</a>}
          {error && <p role="alert" className="text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}