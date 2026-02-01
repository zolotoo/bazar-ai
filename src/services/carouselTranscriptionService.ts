/**
 * Сервис «транскрибации» каруселей через Gemini Flash (картинки → текст по слайдам)
 */

export interface CarouselSlideResult {
  slide_index: number;
  text: string;
  description: string;
}

export interface CarouselTranscriptionResult {
  success: boolean;
  transcript_text: string;
  transcript_slides: CarouselSlideResult[];
}

/**
 * Отправляет слайды карусели (URL картинок) в API и получает текст по каждому слайду + общий текст
 */
export async function transcribeCarouselByUrls(
  imageUrls: string[]
): Promise<CarouselTranscriptionResult | null> {
  try {
    const response = await fetch('/api/transcribe-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      console.error('[CarouselTranscription] API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.transcript_text) {
      console.error('[CarouselTranscription] Invalid response:', data);
      return null;
    }

    return {
      success: true,
      transcript_text: data.transcript_text,
      transcript_slides: Array.isArray(data.transcript_slides) ? data.transcript_slides : [],
    };
  } catch (error) {
    console.error('[CarouselTranscription] Error:', error);
    return null;
  }
}

/**
 * Отправляет слайды карусели (base64) в API
 * Удобно, если картинки уже загружены на клиенте (например через proxy-image)
 */
export async function transcribeCarouselByImages(
  images: { mimeType: string; data: string }[]
): Promise<CarouselTranscriptionResult | null> {
  try {
    const response = await fetch('/api/transcribe-carousel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      console.error('[CarouselTranscription] API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    if (!data.success || !data.transcript_text) {
      console.error('[CarouselTranscription] Invalid response:', data);
      return null;
    }

    return {
      success: true,
      transcript_text: data.transcript_text,
      transcript_slides: Array.isArray(data.transcript_slides) ? data.transcript_slides : [],
    };
  } catch (error) {
    console.error('[CarouselTranscription] Error:', error);
    return null;
  }
}
