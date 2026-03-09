import express from 'express';
import fs from 'fs';
import path from 'path';
import {transpileTSX} from './transpile';
import {initBundle, isReady, getQueueLength, getActiveRenders, getMemoryMB, enqueueRender} from './render-queue';

const app = express();
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Internal-Secret, X-Filename');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (_req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});
app.use(express.json({limit: '2mb'}));

// Temp directory for source videos uploaded by the backend
const SOURCES_DIR = path.join(__dirname, '..', 'temp-sources');
if (!fs.existsSync(SOURCES_DIR)) fs.mkdirSync(SOURCES_DIR, {recursive: true});

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
    activeRenders: getActiveRenders(),
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_RENDERS || '3', 10),
    memoryMB: getMemoryMB(),
  });
});

// Upload source video (backend sends compressed video before rendering)
app.post('/upload-source', requireAuth, express.raw({type: ['video/*', 'image/*', 'application/octet-stream'], limit: '200mb'}), (req, res) => {
  const filename = (req.headers['x-filename'] as string || `source_${Date.now()}.mp4`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(SOURCES_DIR, filename);
  fs.writeFileSync(filePath, req.body);
  const url = `http://localhost:${PORT}/sources/${filename}`;
  console.log(`[SERVER] Source uploaded: ${filename} (${((req.body as Buffer).length / 1024 / 1024).toFixed(1)}MB)`);
  res.json({url, filename});
});

// Serve uploaded source videos (used by OffthreadVideo during render)
app.get('/sources/:filename', (req, res) => {
  const safeName = (req.params.filename as string).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(SOURCES_DIR, safeName);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({error: 'Source not found'});
    return;
  }
  // Determine content type from extension
  const ext = path.extname(safeName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.webm': 'video/webm',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, {start, end});
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Delete uploaded source after render completes
app.delete('/sources/:filename', requireAuth, (req, res) => {
  const safeName = (req.params.filename as string).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(SOURCES_DIR, safeName);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
  res.json({ok: true});
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
    sourceFiles,
    width = 1080,
    height = 1920,
    fps = 30,
    durationInFrames = 150,
  } = req.body;

  if (!code) {
    res.status(400).json({error: 'No composition code provided'});
    return;
  }

  // Multi-file: sourceFiles array takes precedence; single-file: sourceVideoUrl
  const hasSourceFiles = Array.isArray(sourceFiles) && sourceFiles.length > 0;
  if (!sourceVideoUrl && !hasSourceFiles) {
    res.status(400).json({error: 'No sourceVideoUrl or sourceFiles provided'});
    return;
  }

  const primarySource = hasSourceFiles ? sourceFiles[0].url : sourceVideoUrl;
  console.log(`[SERVER] Render request: ${width}x${height} @ ${fps}fps, ${durationInFrames} frames`);
  console.log(`[SERVER] Code: ${code.length} chars, sources: ${hasSourceFiles ? sourceFiles.length + ' files' : primarySource.substring(0, 80) + '...'}`);

  try {
    // Step 1: Transpile TSX → JS
    const transpileStart = Date.now();
    const transpiledCode = await transpileTSX(code);
    console.log(`[SERVER] Transpiled in ${Date.now() - transpileStart}ms (${transpiledCode.length} chars)`);

    // Step 2: Enqueue and render
    const buffer = await enqueueRender({
      transpiledCode,
      sourceVideo: primarySource,
      sourceFiles: hasSourceFiles ? sourceFiles : undefined,
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
        details: msg.substring(0, 2000),
      });
    } else {
      res.status(500).json({
        error: 'Render failed',
        details: msg.substring(0, 2000),
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
