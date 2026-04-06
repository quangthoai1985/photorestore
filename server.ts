import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import sharp from 'sharp';
import path from 'path';
import cors from 'cors';

const REPLICATE_MODEL = 'philz1337x/crystal-upscaler';
const REPLICATE_POLL_INTERVAL_MS = 1600;
const REPLICATE_MAX_POLL_ATTEMPTS = 80;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getReplicateToken = () => {
  const token = (process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim();
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN chưa được cấu hình trên server (.env.local hoặc .env).');
  }
  return token;
};

const callReplicate = async (
  path: string,
  token: string,
  init?: RequestInit,
) => {
  const response = await fetch(`https://api.replicate.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let details = response.statusText;
    try {
      const body = await response.json();
      details = JSON.stringify(body);
    } catch {
      const body = await response.text();
      if (body) details = body;
    }
    throw new Error(`Replicate API ${response.status}: ${details}`);
  }

  return response.json();
};

const waitForReplicatePrediction = async (predictionId: string, token: string) => {
  for (let attempt = 0; attempt < REPLICATE_MAX_POLL_ATTEMPTS; attempt++) {
    const prediction = await callReplicate(`/predictions/${predictionId}`, token, { method: 'GET' });
    if (prediction.status === 'succeeded') return prediction;
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || `Replicate prediction ${prediction.status}`);
    }
    await sleep(REPLICATE_POLL_INTERVAL_MS);
  }

  throw new Error('Replicate upscale timeout.');
};

const normalizeReplicateOutputUrl = (output: any): string => {
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
    return output[0];
  }
  if (typeof output === 'string') {
    return output;
  }
  throw new Error('Replicate không trả về URL ảnh đầu ra hợp lệ.');
};

const parseUpscaleInput = (body: any) => {
  const { imageDataUri, scaleFactor, creativity } = body || {};

  if (!imageDataUri || typeof imageDataUri !== 'string' || !imageDataUri.startsWith('data:image/')) {
    throw new Error('imageDataUri không hợp lệ');
  }

  const parsedScale = Number(scaleFactor);
  const parsedCreativity = Number(creativity);
  const safeScale = Number.isFinite(parsedScale) ? Math.min(4, Math.max(2, parsedScale)) : 2;
  const safeCreativity = Number.isFinite(parsedCreativity)
    ? Math.min(1, Math.max(0, parsedCreativity))
    : 0.3;

  return {
    imageDataUri,
    safeScale,
    safeCreativity,
  };
};

const getPredictionProgress = (status: string, logs?: string): number => {
  const logText = logs || '';
  const matches = [...logText.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1])).filter((v) => Number.isFinite(v));
  const logProgress = matches.length > 0 ? Math.max(...matches) : null;

  if (status === 'succeeded') return 100;
  if (status === 'failed' || status === 'canceled') return 100;
  if (status === 'starting') return 15;
  if (status === 'processing') {
    if (logProgress !== null) {
      return Math.max(20, Math.min(95, logProgress));
    }
    return 60;
  }
  return 8;
};

const getPredictionStatusText = (status: string): string => {
  if (status === 'starting') return 'Replicate đang khởi tạo mô hình...';
  if (status === 'processing') return 'Replicate đang upscale ảnh...';
  if (status === 'succeeded') return 'Upscale hoàn tất';
  if (status === 'failed') return 'Upscale thất bại';
  if (status === 'canceled') return 'Upscale đã bị hủy';
  return 'Yêu cầu đã vào hàng đợi...';
};

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/api/upscale-image/status/:predictionId', async (req, res) => {
  try {
    const predictionId = req.params.predictionId;
    if (!predictionId) {
      return res.status(400).json({ error: 'predictionId không hợp lệ' });
    }

    const token = getReplicateToken();
    const prediction = await callReplicate(`/predictions/${predictionId}`, token, { method: 'GET' });
    const progress = getPredictionProgress(prediction.status, prediction.logs);
    const message = getPredictionStatusText(prediction.status);

    if (prediction.status === 'succeeded') {
      const outputUrl = normalizeReplicateOutputUrl(prediction.output);
      const outputResponse = await fetch(outputUrl);
      if (!outputResponse.ok) {
        throw new Error(`Không tải được ảnh upscale từ Replicate (${outputResponse.status})`);
      }

      const mimeType = outputResponse.headers.get('content-type') || 'image/png';
      const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
      const upscaledImage = `data:${mimeType};base64,${outputBuffer.toString('base64')}`;

      return res.json({
        status: prediction.status,
        progress,
        message,
        upscaledImage,
      });
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return res.json({
        status: prediction.status,
        progress,
        message,
        error: prediction.error || `Replicate prediction ${prediction.status}`,
      });
    }

    return res.json({
      status: prediction.status,
      progress,
      message,
    });
  } catch (error: any) {
    console.error('Upscale Status Error:', error);
    res.status(500).json({ error: error.message || 'Không lấy được trạng thái upscale' });
  }
});

app.post('/api/upscale-image/start', async (req, res) => {
  try {
    const { imageDataUri, safeScale, safeCreativity } = parseUpscaleInput(req.body);
    const token = getReplicateToken();

    const createdPrediction = await callReplicate(`/models/${REPLICATE_MODEL}/predictions`, token, {
      method: 'POST',
      body: JSON.stringify({
        input: {
          image: imageDataUri,
          scale_factor: safeScale,
          creativity: safeCreativity,
        },
      }),
    });

    res.json({
      predictionId: createdPrediction.id,
      status: createdPrediction.status,
      progress: getPredictionProgress(createdPrediction.status, createdPrediction.logs),
      message: getPredictionStatusText(createdPrediction.status),
      scaleFactor: safeScale,
      creativity: safeCreativity,
    });
  } catch (error: any) {
    console.error('Upscale Start Error:', error);
    res.status(500).json({ error: error.message || 'Không thể khởi tạo upscale' });
  }
});

// ----------------------------------------------------------------------
// REPLICATE UPSCALE
// Upscale ảnh bằng philz1337x/crystal-upscaler
// ----------------------------------------------------------------------
app.post('/api/upscale-image', async (req, res) => {
  try {
    const { imageDataUri, safeScale, safeCreativity } = parseUpscaleInput(req.body);

    const token = getReplicateToken();

    const createdPrediction = await callReplicate(`/models/${REPLICATE_MODEL}/predictions`, token, {
      method: 'POST',
      body: JSON.stringify({
        input: {
          image: imageDataUri,
          scale_factor: safeScale,
          creativity: safeCreativity,
        },
      }),
    });

    const completedPrediction = await waitForReplicatePrediction(createdPrediction.id, token);
    const outputUrl = normalizeReplicateOutputUrl(completedPrediction.output);

    const outputResponse = await fetch(outputUrl);
    if (!outputResponse.ok) {
      throw new Error(`Không tải được ảnh upscale từ Replicate (${outputResponse.status})`);
    }

    const mimeType = outputResponse.headers.get('content-type') || 'image/png';
    const outputBuffer = Buffer.from(await outputResponse.arrayBuffer());
    const upscaledImage = `data:${mimeType};base64,${outputBuffer.toString('base64')}`;

    res.json({
      upscaledImage,
      scaleFactor: safeScale,
      creativity: safeCreativity,
    });
  } catch (error: any) {
    console.error('Upscale Error:', error);
    res.status(500).json({ error: error.message || 'Upscale thất bại' });
  }
});

// ----------------------------------------------------------------------
// COMPARISON IMAGE GENERATION
// Ghép ảnh gốc và ảnh đã phục hồi thành 1 ảnh so sánh
// ----------------------------------------------------------------------
app.post('/api/generate-comparison', async (req, res) => {
  try {
    const { originalImage, restoredImage } = req.body;

    if (!originalImage || !restoredImage) {
      return res.status(400).json({ error: 'Missing images' });
    }

    const originalBuffer = Buffer.from(originalImage.split(',')[1], 'base64');
    const restoredBuffer = Buffer.from(restoredImage.split(',')[1], 'base64');

    const originalMetadata = await sharp(originalBuffer).metadata();
    const width = originalMetadata.width || 1024;
    const height = originalMetadata.height || 1024;

    // Resize restored image to match original
    const resizedRestoredBuffer = await sharp(restoredBuffer)
      .resize(width, height, { fit: 'cover' })
      .toBuffer();

    // Layout based on aspect ratio
    const isPortrait = height > width;
    const dividerWidth = 4;

    let totalWidth: number, totalHeight: number;
    if (isPortrait) {
      totalWidth = width * 2 + dividerWidth;
      totalHeight = height;
    } else {
      totalWidth = width;
      totalHeight = height * 2 + dividerWidth;
    }

    // Labels
    const labelHeight = Math.max(40, Math.floor(Math.min(width, height) * 0.05));
    const fontSize = Math.floor(labelHeight * 0.6);

    const svgLabelOriginal = `
      <svg width="${width}" height="${labelHeight + 40}">
        <rect x="20" y="20" width="${fontSize * 4.5}" height="${labelHeight}" fill="rgba(0,0,0,0.6)" rx="8" />
        <text x="${20 + fontSize * 0.5}" y="${20 + fontSize * 1.1}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">GỐC</text>
      </svg>
    `;

    const svgLabelRestored = `
      <svg width="${width}" height="${labelHeight + 40}">
        <rect x="20" y="20" width="${fontSize * 6.5}" height="${labelHeight}" fill="rgba(0,0,0,0.6)" rx="8" />
        <text x="${20 + fontSize * 0.5}" y="${20 + fontSize * 1.1}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">PHỤC HỒI</text>
      </svg>
    `;

    const composites: sharp.OverlayOptions[] = [];

    if (isPortrait) {
      composites.push(
        { input: originalBuffer, left: 0, top: 0 },
        { input: resizedRestoredBuffer, left: width + dividerWidth, top: 0 },
        { input: Buffer.from(svgLabelOriginal), left: 0, top: 0 },
        { input: Buffer.from(svgLabelRestored), left: width + dividerWidth, top: 0 }
      );
    } else {
      composites.push(
        { input: originalBuffer, left: 0, top: 0 },
        { input: resizedRestoredBuffer, left: 0, top: height + dividerWidth },
        { input: Buffer.from(svgLabelOriginal), left: 0, top: 0 },
        { input: Buffer.from(svgLabelRestored), left: 0, top: height + dividerWidth }
      );
    }

    const comparisonBuffer = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite(composites)
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Comparison = `data:image/jpeg;base64,${comparisonBuffer.toString('base64')}`;
    res.json({ comparisonImage: base64Comparison });
  } catch (error: any) {
    console.error('Comparison Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------
// VITE MIDDLEWARE & SERVER START
// ----------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📦 Pipeline: Gemini Native v3.0 (no face-api, no TensorFlow)`);
  });

  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
