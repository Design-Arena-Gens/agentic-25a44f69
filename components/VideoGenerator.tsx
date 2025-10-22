"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResolutionKey = "720p" | "1080p" | "Square";

const RESOLUTION_MAP: Record<ResolutionKey, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  Square: { width: 1080, height: 1080 }
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"]; 
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function VideoGenerator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const [prompt, setPrompt] = useState<string>("A serene sunrise over mountains with floating particles");
  const [subtitle, setSubtitle] = useState<string>("Generated locally with Canvas + WebM");
  const [duration, setDuration] = useState<number>(5);
  const [fps, setFps] = useState<number>(30);
  const [resolutionKey, setResolutionKey] = useState<ResolutionKey>("720p");
  const [bgStyle, setBgStyle] = useState<string>("Aurora");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobSize, setBlobSize] = useState<number>(0);

  const { width, height } = useMemo(() => RESOLUTION_MAP[resolutionKey], [resolutionKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
  }, [width, height]);

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, t: number) => {
      // Background animation
      if (bgStyle === "Aurora") {
        const g = ctx.createLinearGradient(0, 0, width, height);
        const a = Math.sin(t * 0.0006) * 0.5 + 0.5;
        const b = Math.sin(t * 0.0009 + 1.2) * 0.5 + 0.5;
        const c = Math.sin(t * 0.0007 + 2.7) * 0.5 + 0.5;
        g.addColorStop(0, `rgba(${Math.floor(40 + 80 * a)}, 80, 255, 0.9)`);
        g.addColorStop(1, `rgba(10, ${Math.floor(40 + 140 * b)}, 120, 0.9)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      } else if (bgStyle === "Particles") {
        ctx.fillStyle = "#030614";
        ctx.fillRect(0, 0, width, height);
        const rnd = (seed: number) => {
          return Math.abs(Math.sin(seed * 9999.91));
        };
        for (let i = 0; i < 300; i++) {
          const s = i * 13.37 + t * 0.12;
          const x = (rnd(s) * width) % width;
          const y = (rnd(s + 42) * height) % height;
          const r = 0.5 + (rnd(s + 99) * 2.5);
          const hue = Math.floor(200 + 55 * rnd(s + 7));
          ctx.fillStyle = `hsla(${hue}, 80%, 65%, 0.8)`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Gradient waves
        const gradient = ctx.createRadialGradient(
          width * 0.2,
          height * 0.2,
          50,
          width * 0.5,
          height * 0.6,
          Math.max(width, height)
        );
        const p = (v: number) => Math.sin(t * 0.0005 + v) * 0.5 + 0.5;
        gradient.addColorStop(0, `rgba(20, ${80 + 100 * p(0)}, 255, 0.8)`);
        gradient.addColorStop(1, `rgba(5, 10, ${60 + 120 * p(1.3)}, 1)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      // Prompt text animation
      const title = prompt.trim() || "Your animated title";
      const sub = subtitle.trim();

      const centerX = width / 2;
      const centerY = height / 2;

      const wobble = Math.sin(t * 0.003) * 6;
      ctx.textAlign = "center";

      // Title
      ctx.font = `${Math.floor(Math.min(width, height) * 0.07)}px ui-sans-serif, system-ui, -apple-system`;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 20;
      ctx.fillText(title, centerX, centerY + wobble);

      // Subtitle
      if (sub) {
        ctx.font = `${Math.floor(Math.min(width, height) * 0.03)}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillStyle = "#cfe3ff";
        ctx.shadowBlur = 10;
        ctx.fillText(sub, centerX, centerY + 40 + wobble * 0.5);
      }

      // Framing bars / border
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(12, 12, width - 24, height - 24);
    },
    [bgStyle, height, prompt, subtitle, width]
  );

  const animate = useCallback(
    (ctx: CanvasRenderingContext2D, totalMs: number, frameIntervalMs: number) => {
      const step = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const clamped = Math.min(elapsed, totalMs);
        setProgress((clamped / totalMs) * 100);
        drawFrame(ctx, now);

        if (elapsed < totalMs && isRecording) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          try {
            mediaRecorderRef.current?.stop();
          } catch {}
          setIsRecording(false);
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [drawFrame, isRecording]
  );

  const startRecording = useCallback(async () => {
    if (!canvasRef.current) return;
    if (isRecording) return;

    // Reset
    setBlobUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setBlobSize(0);

    const canvas = canvasRef.current;
    const stream = canvas.captureStream(fps);

    chunksRef.current = [];
    const mimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4" // unlikely supported via MediaRecorder in browsers
    ];
    const supported = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, supported ? { mimeType: supported, videoBitsPerSecond: 6_000_000 } : undefined);
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setBlobSize(blob.size);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    };

    setIsRecording(true);
    setProgress(0);

    const totalMs = duration * 1000;
    startTimeRef.current = performance.now();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    mr.start(Math.max(1000 / fps, 16));
    animate(ctx, totalMs, 1000 / fps);
  }, [animate, duration, fps, isRecording]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { mediaRecorderRef.current?.stop(); } catch {}
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const canDownload = Boolean(blobUrl);

  return (
    <div className="card">
      <div className="title">Text → Video Generator</div>
      <div className="content">
        <div className="controls">
          <div>
            <label>Title</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your scene or title" />
          </div>
          <div>
            <label>Subtitle</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional subtitle" />
          </div>
          <div className="row">
            <div>
              <label>Duration (seconds)</label>
              <input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "0", 10))} />
            </div>
            <div>
              <label>FPS</label>
              <input type="number" min={10} max={60} value={fps} onChange={(e) => setFps(parseInt(e.target.value || "0", 10))} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Resolution</label>
              <select value={resolutionKey} onChange={(e) => setResolutionKey(e.target.value as ResolutionKey)}>
                {Object.keys(RESOLUTION_MAP).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Background</label>
              <select value={bgStyle} onChange={(e) => setBgStyle(e.target.value)}>
                <option value="Aurora">Aurora</option>
                <option value="Particles">Particles</option>
                <option value="Waves">Waves</option>
              </select>
            </div>
          </div>

          <div className="actions">
            {!isRecording ? (
              <button className="button" onClick={startRecording}>Generate Video</button>
            ) : (
              <button className="button secondary" onClick={stopRecording}>Stop</button>
            )}
            {canDownload && (
              <a className="button secondary" href={blobUrl!} download={`text-video-${Date.now()}.webm`}>Download .webm</a>
            )}
          </div>

          <div className="progress" aria-hidden={!isRecording}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="preview">
          <div className="meta">
            <span className="badge">{width}×{height} @ {fps}fps</span>
            <span className="badge">{duration}s • {blobSize ? formatBytes(blobSize) : "0 B"}</span>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
          <div className="canvas-wrap">
            <video ref={videoRef} controls playsInline />
          </div>
          {blobUrl && (
            <small>
              Generated: <a className="link" href={blobUrl} target="_blank" rel="noreferrer">Open blob</a>
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
