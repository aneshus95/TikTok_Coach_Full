import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

let serveUrl: string | null = null;
let bundling = false;

type RenderJob = {
  transpiledCode: string;
  sourceVideo: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  resolve: (buffer: Buffer) => void;
  reject: (error: Error) => void;
};

const queue: RenderJob[] = [];
let isProcessing = false;

/**
 * Bundle compositions once on startup.
 * The serveUrl is reused for ALL renders — no re-bundling needed.
 */
export async function initBundle(): Promise<void> {
  if (bundling || serveUrl) return;
  bundling = true;

  try {
    const {bundle} = await import('@remotion/bundler');
    console.log('[RENDER-QUEUE] Bundling compositions...');
    const startTime = Date.now();

    serveUrl = await bundle({
      entryPoint: path.resolve(__dirname, '../src/index.ts'),
      onProgress: (pct: number) => {
        if (pct % 25 === 0) console.log(`[RENDER-QUEUE] Bundle progress: ${pct}%`);
      },
    });

    console.log(`[RENDER-QUEUE] Bundle ready in ${Date.now() - startTime}ms`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[RENDER-QUEUE] Bundle failed:', msg);
    serveUrl = null;
    throw err;
  } finally {
    bundling = false;
  }
}

export function isReady(): boolean {
  return serveUrl !== null;
}

export function getQueueLength(): number {
  return queue.length + (isProcessing ? 1 : 0);
}

export function getMemoryMB(): number {
  return Math.round(process.memoryUsage.rss() / 1024 / 1024);
}

/**
 * Enqueue a render job. Returns a Promise that resolves with the MP4 buffer.
 */
export function enqueueRender(job: Omit<RenderJob, 'resolve' | 'reject'>): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    queue.push({...job, resolve, reject});
    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const job = queue.shift()!;
  const jobId = crypto.randomBytes(4).toString('hex');
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `remotion_${jobId}.mp4`);

  console.log(`[RENDER-QUEUE] Starting render ${jobId} (queue: ${queue.length} remaining)`);
  console.log(`[RENDER-QUEUE] Params: ${job.width}x${job.height} @ ${job.fps}fps, ${job.durationInFrames} frames`);
  console.log(`[RENDER-QUEUE] Code size: ${job.transpiledCode.length} chars`);

  const startTime = Date.now();

  // Capture console.error/warn during render for detailed error context
  const renderLogs: string[] = [];
  const origError = console.error;
  const origWarn = console.warn;
  const logCapture = (...args: any[]) => {
    const line = args.map(a => typeof a === 'string' ? a : String(a)).join(' ');
    renderLogs.push(line);
  };
  console.error = (...args: any[]) => { logCapture(...args); origError(...args); };
  console.warn = (...args: any[]) => { logCapture(...args); origWarn(...args); };

  try {
    if (!serveUrl) throw new Error('Bundle not ready');

    const {renderMedia, selectComposition} = await import('@remotion/renderer');

    const inputProps = {
      transpiledCode: job.transpiledCode,
      sourceVideo: job.sourceVideo,
    };

    const composition = await selectComposition({
      serveUrl,
      id: 'DynamicRenderer',
      inputProps,
    });

    // Override with requested dimensions/duration
    composition.durationInFrames = job.durationInFrames;
    composition.fps = job.fps;
    composition.width = job.width;
    composition.height = job.height;

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 85,
      enforceAudioTrack: true,
      concurrency: 1, // Limit to prevent OOM
      timeoutInMilliseconds: 3600000,
      onProgress: ({progress}: {progress: number}) => {
        const pct = Math.floor(progress * 100);
        if (pct % 25 === 0 && pct > 0) {
          console.log(`[RENDER-QUEUE] Render ${jobId}: ${pct}%`);
        }
      },
    });

    // Read rendered file into buffer
    const buffer = fs.readFileSync(outputPath);
    const duration = Date.now() - startTime;
    console.log(`[RENDER-QUEUE] Render ${jobId} complete: ${duration}ms, ${(buffer.length / 1024).toFixed(0)}KB`);

    job.resolve(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    origError(`[RENDER-QUEUE] Render ${jobId} failed:`, msg);

    // Attach captured logs to error for self-correction context
    const logContext = renderLogs
      .filter(l => l.includes('Error') || l.includes('failed') || l.includes('volume') || l.includes('filter'))
      .slice(-10)
      .join('\n');
    const fullMsg = logContext ? `${msg}\n\nDetailed logs:\n${logContext}` : msg;
    job.reject(new Error(fullMsg));
  } finally {
    // Restore console
    console.error = origError;
    console.warn = origWarn;

    // Cleanup temp file
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}

    isProcessing = false;
    // Process next job in queue
    if (queue.length > 0) {
      processQueue();
    }
  }
}
