import { getAccessToken } from '../lib/supabase';

type FabricAnalysisResult = {
  description?: string;
  suggestedStyles?: string[];
  dominantColors?: string[];
};

type CouturePreviewResult = {
  detailedDescription?: string;
  generatedImageUrl?: string;
};

type ModelShotResult = {
  generatedImageUrl?: string;
  description?: string;
  storagePath?: string;
  showcaseType?: string;
};

async function postToCoutureAi<T>(payload: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to use AI couture tools.');
  }

  const response = await fetch('/api/ai-couture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'The AI couture service could not complete the request.');
  }

  return data as T;
}

export async function analyzeFabric(base64Image: string, mimeType = 'image/jpeg') {
  return postToCoutureAi<FabricAnalysisResult>({
    mode: 'analyze',
    imageBase64: base64Image,
    mimeType,
  });
}

export async function simulateVirtualTryOn(
  base64Image: string,
  attireType: string,
  mimeType = 'image/jpeg'
) {
  return postToCoutureAi<CouturePreviewResult>({
    mode: 'preview',
    imageBase64: base64Image,
    mimeType,
    attireType,
  });
}

export async function generateModelShot(input: {
  imageBase64: string;
  mimeType?: string;
  showcaseType?: 'ready_stock' | 'delivered_craft';
  garmentHint?: string;
}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to generate model shots.');
  }

  const response = await fetch('/api/generate-model-shot', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unable to generate model shot.');
  }
  return data as ModelShotResult;
}
