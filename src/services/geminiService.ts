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
