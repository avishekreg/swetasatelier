import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { json, readJsonBody, requireUser } from './_lib/auth';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    await requireUser(req);

    const body = readJsonBody<{
      mode?: string;
      imageBase64?: string;
      mimeType?: string;
      attireType?: string;
    }>(req);

    const { mode, imageBase64, mimeType, attireType } = body;

    if (!imageBase64) {
      return json(res, 400, { error: 'Missing source fabric image.' });
    }

    const ai = getClient();
    const safeMimeType = normalizeMimeType(mimeType);

    if (mode === 'analyze') {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: safeMimeType,
              data: imageBase64,
            },
          },
          {
            text:
              "You are a couture design assistant for an Indian boutique. Analyse this fabric or embroidery image and respond in JSON with exactly these keys: description (string), suggestedStyles (array of 3 short strings), dominantColors (array of short strings). Focus on boutique-ready Indian silhouettes and luxury styling.",
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      return json(res, 200, JSON.parse(response.text || '{}'));
    }

    if (mode === 'preview') {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: [
          {
            text: `Use the uploaded fabric as the source material and create a finished boutique couture ${attireType} for an Indian luxury fashion label. Show a graceful Indian female model wearing the fully stitched outfit in an editorial studio scene. Preserve the source fabric palette, embroidery, texture, and drape as faithfully as possible. Return a premium, realistic fashion visual with the garment clearly visible.`,
          },
          {
            inlineData: {
              mimeType: safeMimeType,
              data: imageBase64,
            },
          },
        ],
      });

      const parts = getPartsFromResponse(response);
      const imagePart = parts.find((part: any) => part.inlineData?.data);
      const textPart = parts.find((part: any) => part.text);

      if (!imagePart?.inlineData?.data) {
        return json(res, 502, {
          error:
            'The AI model returned text only. Please try a different fabric image or run the preview again.',
          description: textPart?.text || '',
        });
      }

      return json(res, 200, {
        detailedDescription:
          textPart?.text || `Boutique couture ${attireType} preview generated successfully.`,
        generatedImageUrl: `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`,
      });
    }

    return json(res, 400, { error: 'Unsupported AI mode requested.' });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return json(res, statusCode, {
      error: error instanceof Error ? error.message : 'Unexpected AI couture failure.',
    });
  }
}
