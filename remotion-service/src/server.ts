import express from 'express';
import {transpileTSX} from './transpile';
import {initBundle, isReady, getQueueLength, getMemoryMB, enqueueRender} from './render-queue';

const app = express();
app.use(express.json({limit: '2mb'}));

const PORT = parseInt(process.env.PORT || '3100', 10);
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || '';

// Auth middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (INTERNAL_SECRET) {
    const provided = req.headers['x-internal-secret'] as string;
    if (provided !== INTERNAL_SECRET) {
      res.status(401).json({error: 'Unauthorized'});
      return;
    }
  }
  next();
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: isReady() ? 'ready' : 'initializing',
    queueLength: getQueueLength(),
    memoryMB: getMemoryMB(),
  });
});

// Main render endpoint
app.post('/render', requireAuth, async (req, res) => {
  const startTime = Date.now();

  if (!isReady()) {
    res.status(503).json({error: 'Remotion bundle not ready yet. Try again in a few seconds.'});
    return;
  }

  const {
    code,
    sourceVideoUrl,
    width = 1080,
    height = 1920,
    fps = 30,
    durationInFrames = 150,
  } = req.body;

  if (!code) {
    res.status(400).json({error: 'No composition code provided'});
    return;
  }

  if (!sourceVideoUrl) {
    res.status(400).json({error: 'No sourceVideoUrl provided'});
    return;
  }

  console.log(`[SERVER] Render request: ${width}x${height} @ ${fps}fps, ${durationInFrames} frames`);
  console.log(`[SERVER] Code: ${code.length} chars, source: ${sourceVideoUrl.substring(0, 80)}...`);

  try {
    // Step 1: Transpile TSX → JS
    const transpileStart = Date.now();
    const transpiledCode = await transpileTSX(code);
    console.log(`[SERVER] Transpiled in ${Date.now() - transpileStart}ms (${transpiledCode.length} chars)`);

    // Step 2: Enqueue and render
    const buffer = await enqueueRender({
      transpiledCode,
      sourceVideo: sourceVideoUrl,
      width,
      height,
      fps,
      durationInFrames,
    });

    const totalTime = Date.now() - startTime;
    console.log(`[SERVER] Total render time: ${totalTime}ms, output: ${(buffer.length / 1024).toFixed(0)}KB`);

    // Return MP4 binary
    res.set({
      'Content-Type': 'video/mp4',
      'Content-Length': buffer.length.toString(),
      'X-Render-Time-Ms': totalTime.toString(),
    });
    res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SERVER] Render failed:', msg);

    // Differentiate between transpilation errors and render errors
    if (msg.includes('Transform failed') || msg.includes('Unexpected')) {
      res.status(422).json({
        error: 'Code transpilation failed',
        details: msg.substring(0, 500),
      });
    } else {
      res.status(500).json({
        error: 'Render failed',
        details: msg.substring(0, 500),
      });
    }
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`[SERVER] Crescio Remotion Renderer running on port ${PORT}`);
  console.log(`[SERVER] Auth: ${INTERNAL_SECRET ? 'enabled' : 'DISABLED (no INTERNAL_SECRET set)'}`);

  // Bundle compositions on startup
  try {
    await initBundle();
    console.log('[SERVER] Ready to accept render requests');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SERVER] Failed to bundle on startup:', msg);
    console.error('[SERVER] Will retry on first request...');
  }
});
