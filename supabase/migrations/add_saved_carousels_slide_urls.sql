-- URL всех слайдов карусели (для транскрибации через Gemini Vision)
ALTER TABLE saved_carousels ADD COLUMN IF NOT EXISTS slide_urls JSONB DEFAULT NULL;
COMMENT ON COLUMN saved_carousels.slide_urls IS 'Массив URL изображений слайдов: ["url1", "url2", ...]. Используется для транскрибации через Gemini.';
