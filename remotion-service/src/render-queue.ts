import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

let serveUrl: string | null = null;
let bundling = false;

type SourceFile = {
  url: string;
  type: 'video' | 'image';
  durationInFrames: number;
  label?: string;
};

type RenderJob = {
  transpiledCode: string;
  sourceVideo: string;
  sourceFiles?: SourceFile[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  resolve: (buffer: Buffer) => void;
  reject: (error: Error) => void;
};

const queue: RenderJob[] = [];
let activeRenders = 0;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_RENDERS || '3', 10);

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
    console.log(`[RENDER-QUEUE] Max concurrent renders: ${MAX_CONCURRENT}`);
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
  return queue.length + activeRenders;
}

export function getActiveRenders(): number {
  return activeRenders;
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
  // Process as many jobs as we can up to MAX_CONCURRENT
  while (activeRenders < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    activeRenders++;
    // Fire and forget — each render manages its own lifecycle
    processJob(job).finally(() => {
      activeRenders--;
      // Try to pick up more work
      processQueue();
    });
  }
}

async function processJob(job: RenderJob): Promise<void> {
  const jobId = crypto.randomBytes(4).toString('hex');
  const tmpDir = os.tmpdir();
  const outputPath = path.join(tmpDir, `remotion_${jobId}.mp4`);

  console.log(`[RENDER-QUEUE] Starting render ${jobId} (active: ${activeRenders}/${MAX_CONCURRENT}, queued: ${queue.length})`);
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
      sourceFiles: job.sourceFiles || [],
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

    // Scale per-render concurrency based on active renders
    // With 16GB RAM and 4 CPUs, distribute resources
    const perRenderConcurrency = Math.max(1, Math.floor(4 / activeRenders));

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 85,
      enforceAudioTrack: true,
      concurrency: perRenderConcurrency,
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
  }
}
