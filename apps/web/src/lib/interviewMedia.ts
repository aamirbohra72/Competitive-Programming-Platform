/**
 * Interview needs a working microphone. Camera is optional: many laptops fail
 * video (in use, virtual cam, drivers) while audio still works — requesting both
 * in one call makes the whole getUserMedia fail.
 */

export type InterviewMediaResult = {
  stream: MediaStream;
  hasVideo: boolean;
  notices: string[];
};

function mapGetUserMediaError(err: unknown, device: 'microphone' | 'camera'): string {
  const name = err instanceof DOMException ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return device === 'microphone'
      ? 'Microphone access was blocked. Allow the mic for this site in your browser settings.'
      : 'Camera access was blocked. You can continue with microphone only.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return device === 'microphone'
      ? 'No microphone was found. Connect a mic or type your answers.'
      : 'No camera was found. Continuing with microphone only.';
  }
  if (
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    message.toLowerCase().includes('could not start video source') ||
    message.toLowerCase().includes('could not start audio source')
  ) {
    return device === 'microphone'
      ? 'Your microphone is in use by another app or cannot be started. Close other apps using the mic and try again.'
      : 'Your camera could not be started (often in use by another app). Continuing with microphone only.';
  }
  if (name === 'OverconstrainedError') {
    return device === 'microphone'
      ? 'Microphone constraints could not be satisfied.'
      : 'Camera constraints could not be satisfied. Continuing without video.';
  }
  if (name === 'AbortError') {
    return 'Media request was cancelled.';
  }
  return device === 'microphone' ? message || 'Could not access microphone.' : message;
}

async function getVideoTrack(cameraId?: string): Promise<MediaStream | null> {
  const attempts: MediaStreamConstraints[] = cameraId ? [
    { video: { deviceId: { exact: cameraId } } },
  ] : [
    { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } },
    { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
    { video: true },
  ];

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      /* try next constraint set */
    }
  }
  return null;
}

export async function acquireInterviewMedia(options?: { microphoneId?: string; cameraId?: string }): Promise<InterviewMediaResult> {
  const notices: string[] = [];

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Your browser does not support media capture. Use a recent Chrome, Edge, or Firefox, or type your answers.',
    );
  }

  if (typeof window !== 'undefined' && !window.isSecureContext && !window.location.hostname.includes('localhost')) {
    throw new Error('Interview requires HTTPS. Open the site over https:// (not http://) except on localhost.');
  }

  let audioStream: MediaStream;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(options?.microphoneId ? { deviceId: { exact: options.microphoneId } } : {}),
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
  } catch (e) {
    throw new Error(mapGetUserMediaError(e, 'microphone'));
  }

  const videoStream = await getVideoTrack(options?.cameraId);

  if (!videoStream) {
    notices.push(
      'Camera unavailable — interview runs on your microphone only (no video is uploaded).',
    );
  }

  const stream = new MediaStream([
    ...audioStream.getAudioTracks(),
    ...(videoStream ? videoStream.getVideoTracks() : []),
  ]);

  return {
    stream,
    hasVideo: Boolean(videoStream && videoStream.getVideoTracks().length > 0),
    notices,
  };
}
