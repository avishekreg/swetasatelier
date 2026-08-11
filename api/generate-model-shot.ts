import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getServiceClient, json, readJsonBody, requireUser } from './_lib/auth';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in Vercel environment variables.');
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

function normalizeMimeType(mimeType: unknown) {
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return mimeType;
  }
  return 'image/jpeg';
}

function getPartsFromResponse(response: any) {
  return response?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || [];
}

function decodeBase64ToBuffer(base64: string) {
  return Buffer.from(base64, 'base64');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const { role } = await requireUser(req);
    if (!['super_admin', 'admin'].includes(role)) {
      return json(res, 403, { error: 'Only admin roles can generate model shots.' });
    }

    const body = readJsonBody<{
      imageBase64?: string;
      mimeType?: string;
      showcaseType?: 'ready_stock' | 'delivered_craft';
      garmentHint?: string;
    }>(req);

    const { imageBase64, mimeType, showcaseType = 'ready_stock', garmentHint } = body;

    if (!imageBase64) {
      return json(res, 400, { error: 'Missing product photo (imageBase64).' });
    }

    const ai = getClient();
    const safeMime = normalizeMimeType(mimeType);
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt =
      showcaseType === 'delivered_craft'
        ? `You are a luxury Indo-Western boutique visualizer for Sweta's Atelier.
Transform this plain product / delivery photo of a finished garment into a premium editorial model shot.
Requirements:
- Remove cluttered or plain backgrounds.
- Dress an elegant Indian / Indo-Western female model in the exact garment, preserving colors, embroidery, silhouette, and fabric texture faithfully.
- Place her in a warm, high-end boutique interior (soft gold light, artisan atelier ambience).
- Photorealistic fashion editorial, vertical portrait composition, garment clearly visible.
${garmentHint ? `Garment context: ${garmentHint}` : ''}
Return a single finished image only.`
        : `You are a luxury Indo-Western boutique visualizer for Sweta's Atelier.
Transform this plain hanger / mannequin / flat-lay product photo into a premium ready-to-wear catalog model shot.
Requirements:
- Cleanly isolate the garment and remove the plain background.
- Fit the exact garment onto an elegant Indian / Indo-Western female model, preserving embroidery, color, and drape.
- Set a luxurious boutique interior background with soft editorial lighting.
- Photorealistic e-commerce / lookbook quality, vertical composition, garment as the hero.
${garmentHint ? `Garment context: ${garmentHint}` : ''}
Return a single finished image only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: safeMime,
            data: rawBase64,
          },
        },
      ],
    });

    const parts = getPartsFromResponse(response);
    const imagePart = parts.find((part: any) => part.inlineData?.data);
    const textPart = parts.find((part: any) => part.text);

    if (!imagePart?.inlineData?.data) {
      return json(res, 502, {
        error: 'The AI model did not return an image. Try a clearer product photo.',
        description: textPart?.text || '',
      });
    }

    const outMime = imagePart.inlineData.mimeType || 'image/png';
    const buffer = decodeBase64ToBuffer(imagePart.inlineData.data);
    const ext = outMime.includes('jpeg') || outMime.includes('jpg') ? 'jpg' : 'png';
    const filePath = `model-shots/${showcaseType}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const admin = getServiceClient();
    const { error: uploadError } = await admin.storage.from('fabrics').upload(filePath, buffer, {
      contentType: outMime,
      upsert: false,
      cacheControl: '3600',
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = admin.storage.from('fabrics').getPublicUrl(filePath);

    return json(res, 200, {
      generatedImageUrl: publicData.publicUrl,
      storagePath: filePath,
      description: textPart?.text || 'Boutique model shot generated successfully.',
      showcaseType,
    });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unable to generate model shot.',
    });
  }
}
