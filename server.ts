import dotenv from 'dotenv';
dotenv.config(); // Phải gọi cái này đầu tiên để nạp file .env vào process.env

import express from 'express';
import { createServer as createViteServer } from 'vite';
import sharp from 'sharp';
import * as faceapi from '@vladmandic/face-api';
import { Canvas, Image, ImageData } from 'canvas';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

// Patch face-api for Node.js environment
faceapi.env.monkeyPatch({ Canvas, Image, ImageData } as any);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ----------------------------------------------------------------------
// LOAD FACE-API MODELS
// ----------------------------------------------------------------------
let modelsLoaded = false;
async function loadModels() {
  try {
    // In a real production environment, you would download the weights
    // and place them in a /models directory.
    const modelPath = path.join(process.cwd(), 'models');
    if (fs.existsSync(modelPath)) {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
      modelsLoaded = true;
      console.log('✅ Face-api models loaded successfully.');
    } else {
      console.warn('⚠️ Face-api models directory not found at:', modelPath);
      console.warn('⚠️ Face detection will be mocked for demonstration.');
    }
  } catch (e) {
    console.error('❌ Error loading face-api models:', e);
  }
}
loadModels();

// ----------------------------------------------------------------------
// HELPER: IMAGE UPSCALING
// ----------------------------------------------------------------------
async function upscaleImage(buffer: Buffer, resolution: string): Promise<Buffer> {
  const targetSize = resolution === '4K' ? 3840 : (resolution === '2K' ? 2560 : 1920);
  return await sharp(buffer)
    .resize(targetSize, targetSize, {
      fit: 'inside', // Giữ nguyên tỷ lệ khung hình, chỉ phóng to cạnh dài nhất
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3 // Thuật toán nội suy chất lượng cao để giữ nét
    })
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4', mozjpeg: false }) // Xuất chất lượng cao nhất
    .toBuffer();
}

app.post('/api/upscale-image', async (req, res) => {
  try {
    const { imageBase64, selectedResolution } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
    
    const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
    const finalBuffer = await upscaleImage(buffer, selectedResolution);
    
    res.json({ success: true, image: `data:image/jpeg;base64,${finalBuffer.toString('base64')}` });
  } catch (error: any) {
    console.error('Upscale Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------
// PORTRAIT RESTORE PIPELINE (DEPRECATED - MOVED TO FRONTEND)
// ----------------------------------------------------------------------
// app.post('/api/restore-portrait', async (req, res) => { ... });

// ----------------------------------------------------------------------
// HYBRID PIPELINE STEP 3: EXTRACT FACES
// ----------------------------------------------------------------------
app.post('/api/process-hybrid', async (req, res) => {
  try {
    const { imageBase64, detectionSensitivity = 50, maxFaces = 'all' } = req.body;
    console.log('[process-hybrid] modelsLoaded:', modelsLoaded, '| imageBase64 length:', imageBase64?.length);
    if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

    const base64Data = imageBase64.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 1;
    const imgHeight = metadata.height || 1;

    let faces: { x: number, y: number, width: number, height: number, imageBase64: string }[] = [];

    if (modelsLoaded) {
      const img = new Image();
      img.src = imageBuffer;
      const minConf = Math.max(0.1, Math.min(0.9, 1.0 - (detectionSensitivity / 100)));
      const options = new faceapi.SsdMobilenetv1Options({ minConfidence: minConf });
      const detections = await faceapi.detectAllFaces(img as any, options);
      
      let faceBoxes = detections.map(det => {
        const box = det.box;
        const marginX = box.width * 0.2;
        const marginY = box.height * 0.2;
        const x = Math.max(0, Math.floor(box.x - marginX));
        const y = Math.max(0, Math.floor(box.y - marginY));
        const width = Math.min(imgWidth - x, Math.ceil(box.width + marginX * 2));
        const height = Math.min(imgHeight - y, Math.ceil(box.height + marginY * 2));
        return { x, y, width, height };
      });
      
      faceBoxes.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      if (maxFaces !== 'all') {
        const limit = parseInt(maxFaces as string, 10);
        if (!isNaN(limit)) faceBoxes = faceBoxes.slice(0, limit);
      }
      
      for (const box of faceBoxes) {
        const faceBuffer = await sharp(imageBuffer)
          .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
          .png()
          .toBuffer();
        faces.push({
          ...box,
          imageBase64: faceBuffer.toString('base64')
        });
      }
    } else {
      console.warn("Face-api models not loaded. Using center-crop fallback.");
      // Fallback: crop vùng trung tâm-trên của ảnh (thường chứa khuôn mặt
      // trong ảnh chân dung và ảnh nhóm). Tạo ra 1 face region dựa theo tỷ lệ.
      const fallbackCropWidth = Math.floor(imgWidth * 0.6);
      const fallbackCropHeight = Math.floor(imgHeight * 0.6);
      const fallbackX = Math.floor((imgWidth - fallbackCropWidth) / 2);
      const fallbackY = Math.floor(imgHeight * 0.04);
      // Giới hạn để không vượt quá kích thước ảnh
      const safeWidth = Math.min(fallbackCropWidth, imgWidth - fallbackX);
      const safeHeight = Math.min(fallbackCropHeight, imgHeight - fallbackY);
      if (safeWidth > 40 && safeHeight > 40) {
        const fallbackBuffer = await sharp(imageBuffer)
          .extract({
            left: fallbackX,
            top: fallbackY,
            width: safeWidth,
            height: safeHeight
          })
          .png()
          .toBuffer();
        faces.push({
          x: fallbackX,
          y: fallbackY,
          width: safeWidth,
          height: safeHeight,
          imageBase64: fallbackBuffer.toString('base64')
        });
      }
    }

    res.json({ success: true, faces });
  } catch (error: any) {
    console.error('Process Hybrid Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------
// HYBRID PIPELINE STEP 5: FINALIZE IMAGE
// ----------------------------------------------------------------------
app.post('/api/finalize-image', async (req, res) => {
  try {
    const { baseImageBase64, clothingImageBase64, faces, blendingSmoothness = 60, selectedResolution = '1K' } = req.body;
    console.log('[finalize-image] faces count:', faces?.length ?? 0, '| resolution:', selectedResolution);
    if (!baseImageBase64) return res.status(400).json({ error: 'Missing baseImageBase64' });

    const baseBufferRaw = Buffer.from(baseImageBase64.split(',')[1], 'base64');
    
    // Giảm nhẹ độ bão hòa màu của hậu cảnh (base image) để tạo cảm giác hài hòa, cổ điển
    const baseBuffer = await sharp(baseBufferRaw)
      .modulate({ saturation: 0.9 })
      .toBuffer();

    let finalImageBuffer = baseBuffer;

    const metadata = await sharp(baseBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // --- LAYER 2: CLOTHING ENHANCEMENT ---
    if (clothingImageBase64) {
      console.log("Applying clothing enhancement layer...");
      const clothingBuffer = Buffer.from(clothingImageBase64.split(',')[1] || clothingImageBase64, 'base64');
      
      // Create soft mask for clothing (focus on lower 2/3rds, fade out)
      const svgMask = `
        <svg width="${width}" height="${height}">
          <defs>
            <filter id="blur">
              <feGaussianBlur stdDeviation="${width * 0.08}" />
            </filter>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="black" />
          <ellipse cx="${width / 2}" cy="${height * 0.65}" rx="${width * 0.45}" ry="${height * 0.45}" fill="white" filter="url(#blur)" />
        </svg>
      `;

      const maskedClothing = await sharp(clothingBuffer)
        .resize(width, height, { fit: 'fill' })
        .composite([{ input: Buffer.from(svgMask), blend: 'dest-in' }])
        .png()
        .toBuffer();

      finalImageBuffer = await sharp(baseBuffer)
        .composite([{ input: maskedClothing, blend: 'over' }])
        .png()
        .toBuffer();
    }

    if (faces && faces.length > 0) {
      console.log(`Compositing ${faces.length} faces onto base image...`);
      const composites = await Promise.all(faces.map(async (face: any) => {
        const { x, y, width, height, imageBase64 } = face;
        const faceBuffer = Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64');

        // Resize face to match original detection box
        const resizedFaceBuffer = await sharp(faceBuffer)
          .resize(width, height, { fit: 'fill' })
          .png()
          .toBuffer();

        // Apply feathering mask (Increased for smoother blending)
        const featherRatio = (blendingSmoothness / 100) * 0.5;
        const feather = Math.max(8, Math.floor(Math.min(width, height) * featherRatio));
        const stdDev = Math.max(2, feather / 1.2);
        const innerWidth = Math.max(1, width - feather * 2);
        const innerHeight = Math.max(1, height - feather * 2);

        const ellipseCx = width / 2;
        const ellipseCy = height * 0.45;
        const ellipseRx = (width / 2) - feather;
        const ellipseRy = (height / 2) - feather * 0.6;
        const svgMask = `
          <svg width="${width}" height="${height}">
            <defs>
              <filter id="blur">
                <feGaussianBlur stdDeviation="${stdDev}" />
              </filter>
            </defs>
            <rect x="0" y="0" width="${width}" height="${height}" fill="black" />
            <ellipse
              cx="${ellipseCx}"
              cy="${ellipseCy}"
              rx="${Math.max(1, ellipseRx)}"
              ry="${Math.max(1, ellipseRy)}"
              fill="white"
              filter="url(#blur)"
            />
          </svg>
        `;
        
        const featheredFace = await sharp(resizedFaceBuffer)
          .composite([{ input: Buffer.from(svgMask), blend: 'dest-in' }])
          .png()
          .toBuffer();

        // Advanced color normalization: match face to surrounding body area
        let normalizedFace = featheredFace;
        try {
          const imgMeta = await sharp(finalImageBuffer).metadata();
          const imgWidth = imgMeta.width || 1024;
          const imgHeight = imgMeta.height || 1024;

          // Sample 3 zones around the face for robust color matching
          const sampleZones = [
            // Zone 1: Neck area (directly below face)
            {
              left: Math.max(0, Math.floor(x + width * 0.3)),
              top: Math.min(imgHeight - 20, y + height + 5),
              width: Math.floor(width * 0.4),
              height: Math.max(4, Math.floor(height * 0.08))
            },
            // Zone 2: Left shoulder area
            {
              left: Math.max(0, x - Math.floor(width * 0.2)),
              top: Math.floor(y + height * 0.6),
              width: Math.floor(width * 0.2),
              height: Math.floor(height * 0.15)
            },
            // Zone 3: Right shoulder area  
            {
              left: Math.min(imgWidth - 20, x + width + 5),
              top: Math.floor(y + height * 0.6),
              width: Math.floor(width * 0.2),
              height: Math.floor(height * 0.15)
            }
          ].filter(z =>
            z.left >= 0 && z.top >= 0 &&
            z.left + z.width <= imgWidth &&
            z.top + z.height <= imgHeight &&
            z.width > 4 && z.height > 4
          );

          if (sampleZones.length > 0) {
            // Get stats from surrounding area
            const surroundStats = await Promise.all(
              sampleZones.map(z => sharp(finalImageBuffer).extract(z).stats())
            );

            // Average brightness across all zones
            const surroundBrightness = surroundStats.reduce(
              (sum, s) => sum + s.channels[0].mean, 0
            ) / surroundStats.length;

            // Get face brightness (center region only, avoid edges)
            const faceCenterW = Math.max(4, Math.floor(width * 0.5));
            const faceCenterH = Math.max(4, Math.floor(height * 0.5));
            const faceStats = await sharp(featheredFace)
              .extract({
                left: Math.floor(width * 0.25),
                top: Math.floor(height * 0.2),
                width: faceCenterW,
                height: faceCenterH
              })
              .stats();
            const faceBrightness = faceStats.channels[0].mean;

            if (faceBrightness > 10 && surroundBrightness > 10) {
              const ratio = surroundBrightness / faceBrightness;
              const clampedRatio = Math.max(0.80, Math.min(1.20, ratio));

              if (Math.abs(clampedRatio - 1.0) > 0.05) {
                normalizedFace = await sharp(featheredFace)
                  .modulate({ brightness: clampedRatio, saturation: 0.97 })
                  .png()
                  .toBuffer();
                console.log(
                  `[finalize] Face @(${x},${y}): brightness ratio=${clampedRatio.toFixed(3)}`
                );
              }
            }
          }
        } catch (normErr) {
          console.warn('[finalize] Color normalization skipped:', normErr);
          normalizedFace = featheredFace;
        }

        return {
          input: normalizedFace,
          top: y,
          left: x,
        };
      }));
      
      finalImageBuffer = await sharp(finalImageBuffer)
        .composite(composites)
        .toBuffer();
      
      // Second-pass: global tone unification sau composite
      // Giảm nhẹ local contrast để thống nhất tone toàn ảnh
      finalImageBuffer = await sharp(finalImageBuffer)
        .modulate({ saturation: 0.98 })
        .toBuffer();
      console.log('[finalize] Global tone unification applied.');
      
      console.log("Compositing completed successfully.");
    }

    // --- STEP 6: UPSCALING ---
    console.log(`Upscaling image to ${selectedResolution}...`);
    let finalBuffer = await upscaleImage(finalImageBuffer, selectedResolution);

    // --- STEP 7: GLOBAL POST-PROCESSING ---
    console.log(`Applying global post-processing (brightness, sharpen) for ${selectedResolution}...`);
    const sharpenSigma = selectedResolution === '4K' ? 1.0 : (selectedResolution === '2K' ? 0.8 : 0.5);
    finalBuffer = await sharp(finalBuffer)
      .modulate({ brightness: 1.02 }) // Tăng sáng nhẹ, không tăng saturation để giữ nét cổ điển
      .sharpen({ sigma: sharpenSigma, m1: 1.5, m2: 0.7 }) // Làm nét dựa trên độ phân giải
      .jpeg({ quality: 97, chromaSubsampling: '4:4:4', mozjpeg: false })
      .toBuffer();
    
    res.json({ success: true, image: `data:image/jpeg;base64,${finalBuffer.toString('base64')}` });
  } catch (error: any) {
    console.error('Finalize Image Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------
// COMPARISON IMAGE GENERATION
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

    // 1. CHUẨN HÓA KÍCH THƯỚC (Normalization)
    // Resize restored image to exactly match original
    const resizedRestoredBuffer = await sharp(restoredBuffer)
      .resize(width, height, { fit: 'cover' })
      .toBuffer();

    // Determine layout based on aspect ratio
    const isPortrait = height > width;
    const dividerWidth = 4;
    
    let totalWidth, totalHeight;
    if (isPortrait) {
      // Side-by-side (Horizontal)
      totalWidth = width * 2 + dividerWidth;
      totalHeight = height;
    } else {
      // Top-and-bottom (Vertical)
      totalWidth = width;
      totalHeight = height * 2 + dividerWidth;
    }

    // 3. THÊM NHÃN CHỮ (Labeling)
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

    // 2. TẠO CANVAS GHÉP (Stitching)
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
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White divider
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
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handlers
  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    
    // Force exit after 5 seconds if not closed
    setTimeout(() => {
      console.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
