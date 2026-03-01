const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(express.json({limit: '10mb'}));

const PORT = process.env.REMOTION_PORT || 3100;
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
}

let bundlePath = null;
let bundling = false;

// Template -> Composition ID mapping (for legacy single-template requests)
const TEMPLATE_MAP = {
  text: 'TextOverlay',
  particles: 'ParticleEffect',
  glow: 'GlowEffect',
  transform: 'TransformEffect',
  captions: 'CaptionOverlay',
  autozoom: 'AutoZoomEffect',
};

async function initBundle() {
  if (bundling) return;
  bundling = true;

  try {
    const {bundle} = require('@remotion/bundler');
    console.log('[REMOTION] Bundling project...');
    const startTime = Date.now();

    bundlePath = await bundle({
      entryPoint: path.resolve(__dirname, 'src/index.ts'),
      onProgress: (pct) => {
        if (pct % 25 === 0) console.log(`[REMOTION] Bundle progress: ${pct}%`);
      },
    });

    console.log(`[REMOTION] Bundle ready in ${Date.now() - startTime}ms`);
    console.log(`[REMOTION] Bundle path: ${bundlePath}`);
  } catch (err) {
    console.error('[REMOTION] Bundle failed:', err.message);
    bundlePath = null;
  } finally {
    bundling = false;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: bundlePath ? 'ready' : 'initializing',
    bundled: !!bundlePath,
    templates: Object.keys(TEMPLATE_MAP),
    modes: ['layers', 'custom'],
  });
});

// Main render endpoint — supports multi-layer and legacy single-template
app.post('/render', async (req, res) => {
  const startTime = Date.now();

  if (!bundlePath) {
    return res.status(503).json({error: 'Remotion bundle not ready yet. Try again in a few seconds.'});
  }

  const {
    template,           // legacy single-template
    props = {},         // legacy single-template props
    layers,             // new multi-layer format
    duration_seconds = 5,
    fps = 30,
    width = 1080,
    height = 1920,
    source_video_path,
  } = req.body;

  // Validate: need either layers array or valid template
  if (!layers && (!template || !TEMPLATE_MAP[template])) {
    return res.status(400).json({
      error: `Provide 'layers' array or valid 'template'. Available templates: ${Object.keys(TEMPLATE_MAP).join(', ')}`,
    });
  }

  const durationInFrames = Math.ceil(duration_seconds * fps);

  // Dedicated compositions for captions and autozoom; otherwise OverlayWithVideo
  const DEDICATED_TEMPLATES = ['captions', 'autozoom'];
  const compositionId = (template && DEDICATED_TEMPLATES.includes(template))
    ? TEMPLATE_MAP[template]
    : 'OverlayWithVideo';

  // Build inputProps based on format
  let inputProps;
  if (template && DEDICATED_TEMPLATES.includes(template)) {
    // Captions/autozoom: pass props directly + sourceVideo
    inputProps = {sourceVideo: source_video_path || '', ...props};
  } else if (layers) {
    inputProps = {sourceVideo: source_video_path || '', layers};
  } else {
    inputProps = {sourceVideo: source_video_path || '', template, effectProps: props};
  }

  // Output file
  const outputId = crypto.randomBytes(8).toString('hex');
  const outputPath = path.join(OUTPUT_DIR, `overlay_${outputId}.mp4`);

  const layerSummary = layers
    ? layers.map(l => l.type).join('+')
    : template;
  console.log(`[REMOTION] Render: effects=${layerSummary}, duration=${duration_seconds}s, source=${source_video_path ? 'yes' : 'no'}`);
  if (layers) {
    console.log(`[REMOTION] Layers (${layers.length}):`, layers.map(l => `${l.type}(${JSON.stringify(l.props).substring(0, 80)})`).join(', '));
  } else {
    console.log(`[REMOTION] Effect props:`, JSON.stringify(props).substring(0, 200));
  }

  try {
    const {renderMedia, selectComposition} = require('@remotion/renderer');

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: compositionId,
      inputProps,
    });

    // Override duration/dimensions
    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = width;
    composition.height = height;

    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
      onProgress: ({progress}) => {
        if (Math.floor(progress * 100) % 25 === 0) {
          console.log(`[REMOTION] Render progress: ${Math.floor(progress * 100)}%`);
        }
      },
    });

    const duration = Date.now() - startTime;
    const stats = fs.statSync(outputPath);
    console.log(`[REMOTION] Render complete: ${duration}ms, ${(stats.size / 1024).toFixed(0)}KB`);

    res.json({
      overlay_path: outputPath,
      duration_ms: duration,
      size_bytes: stats.size,
      codec: 'h264',
      format: 'mp4',
    });
  } catch (err) {
    console.error('[REMOTION] Render failed:', err.message);
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    res.status(500).json({error: `Render failed: ${err.message}`});
  }
});

// Custom code render endpoint — Claude generates full Remotion component
app.post('/render-custom', async (req, res) => {
  const startTime = Date.now();

  const {
    code,
    duration_seconds = 5,
    fps = 30,
    width = 1080,
    height = 1920,
    source_video_path,
  } = req.body;

  if (!code) {
    return res.status(400).json({error: 'No code provided'});
  }

  const outputId = crypto.randomBytes(8).toString('hex');
  const outputPath = path.join(OUTPUT_DIR, `custom_${outputId}.mp4`);

  console.log(`[REMOTION] Custom render: ${code.length} chars, duration=${duration_seconds}s`);
  console.log(`[REMOTION] Code preview: ${code.substring(0, 150)}...`);

  try {
    // Write Claude-generated component to file
    const generatedPath = path.resolve(__dirname, 'src/compositions/Generated.tsx');
    fs.writeFileSync(generatedPath, code, 'utf-8');
    console.log('[REMOTION] Wrote generated component to Generated.tsx');

    // Re-bundle with the new code
    const {bundle} = require('@remotion/bundler');
    console.log('[REMOTION] Re-bundling with custom code...');
    const rebundleStart = Date.now();
    const customBundle = await bundle({
      entryPoint: path.resolve(__dirname, 'src/index.ts'),
      onProgress: (pct) => {
        if (pct % 50 === 0) console.log(`[REMOTION] Custom bundle progress: ${pct}%`);
      },
    });
    console.log(`[REMOTION] Custom bundle ready in ${Date.now() - rebundleStart}ms`);

    const durationInFrames = Math.ceil(duration_seconds * fps);
    const inputProps = {sourceVideo: source_video_path || ''};

    const {renderMedia, selectComposition} = require('@remotion/renderer');

    const composition = await selectComposition({
      serveUrl: customBundle,
      id: 'GeneratedEffect',
      inputProps,
    });

    composition.durationInFrames = durationInFrames;
    composition.fps = fps;
    composition.width = width;
    composition.height = height;

    await renderMedia({
      composition,
      serveUrl: customBundle,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
      onProgress: ({progress}) => {
        if (Math.floor(progress * 100) % 25 === 0) {
          console.log(`[REMOTION] Custom render progress: ${Math.floor(progress * 100)}%`);
        }
      },
    });

    const duration = Date.now() - startTime;
    const stats = fs.statSync(outputPath);
    console.log(`[REMOTION] Custom render complete: ${duration}ms, ${(stats.size / 1024).toFixed(0)}KB`);

    res.json({
      overlay_path: outputPath,
      duration_ms: duration,
      size_bytes: stats.size,
      codec: 'h264',
      format: 'mp4',
    });
  } catch (err) {
    console.error('[REMOTION] Custom render failed:', err.message);
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    res.status(500).json({error: `Custom render failed: ${err.message}`});
  }
});

// Cleanup old renders (files older than 1 hour)
setInterval(() => {
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();
    for (const file of files) {
      const fp = path.join(OUTPUT_DIR, file);
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > 3600000) {
        fs.unlinkSync(fp);
        console.log(`[REMOTION] Cleaned up: ${file}`);
      }
    }
  } catch {}
}, 600000); // Every 10 minutes

// Start server and bundle
app.listen(PORT, async () => {
  console.log(`[REMOTION] Overlay service running on port ${PORT}`);
  console.log(`[REMOTION] Templates: ${Object.keys(TEMPLATE_MAP).join(', ')}`);
  console.log(`[REMOTION] Modes: layers (multi-effect), custom (Claude-generated code)`);
  await initBundle();
});
