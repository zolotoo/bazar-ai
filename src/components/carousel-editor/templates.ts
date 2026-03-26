export interface SlideField {
  id: string;
  label: string;
  placeholder: string;
  type: 'title' | 'subtitle' | 'body' | 'tag';
  maxLength?: number;
}

export interface SlideTemplate {
  fields: SlideField[];
}

export interface CarouselTemplate {
  id: string;
  name: string;
  description: string;
  previewEmoji: string;
  // Style
  bgClass: string;
  textColorClass: string;
  accentColorClass: string;
  fontClass: string;
  // Slides config
  slides: SlideTemplate[];
  maxSlides: number;
  defaultSlideCount: number;
}

// Default fields per slide
const standardSlide: SlideTemplate = {
  fields: [
    { id: 'title', label: 'Заголовок', placeholder: 'Главная мысль', type: 'title', maxLength: 60 },
    { id: 'subtitle', label: 'Подзаголовок', placeholder: 'Пояснение', type: 'subtitle', maxLength: 100 },
    { id: 'body', label: 'Текст', placeholder: 'Основной текст слайда...', type: 'body', maxLength: 300 },
  ],
};

const coverSlide: SlideTemplate = {
  fields: [
    { id: 'title', label: 'Заголовок', placeholder: 'Название карусели', type: 'title', maxLength: 60 },
    { id: 'subtitle', label: 'Подзаголовок', placeholder: '@username или описание', type: 'subtitle', maxLength: 80 },
    { id: 'tag', label: 'Тег', placeholder: '#тема', type: 'tag', maxLength: 30 },
  ],
};

const ctaSlide: SlideTemplate = {
  fields: [
    { id: 'title', label: 'Призыв', placeholder: 'Подпишись!', type: 'title', maxLength: 40 },
    { id: 'subtitle', label: 'Описание', placeholder: 'Больше полезного контента', type: 'subtitle', maxLength: 100 },
    { id: 'tag', label: '@', placeholder: '@yourhandle', type: 'tag', maxLength: 30 },
  ],
};

function makeSlides(count: number): SlideTemplate[] {
  return [
    coverSlide,
    ...Array.from({ length: count - 2 }, () => standardSlide),
    ctaSlide,
  ];
}

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: 'minimal-dark',
    name: 'Минимал',
    description: 'Тёмный фон, белый текст',
    previewEmoji: '🖤',
    bgClass: 'bg-[#1a1a2e]',
    textColorClass: 'text-white',
    accentColorClass: 'text-indigo-400',
    fontClass: 'font-sans',
    slides: makeSlides(5),
    maxSlides: 10,
    defaultSlideCount: 5,
  },
  {
    id: 'warm-gradient',
    name: 'Тёплый',
    description: 'Персиковый градиент',
    previewEmoji: '🍑',
    bgClass: 'bg-gradient-to-br from-orange-100 via-rose-100 to-pink-200',
    textColorClass: 'text-gray-900',
    accentColorClass: 'text-rose-600',
    fontClass: 'font-sans',
    slides: makeSlides(5),
    maxSlides: 10,
    defaultSlideCount: 5,
  },
  {
    id: 'bold-blue',
    name: 'Синий',
    description: 'Яркий синий, контраст',
    previewEmoji: '💙',
    bgClass: 'bg-gradient-to-br from-blue-600 to-indigo-800',
    textColorClass: 'text-white',
    accentColorClass: 'text-yellow-300',
    fontClass: 'font-sans',
    slides: makeSlides(5),
    maxSlides: 10,
    defaultSlideCount: 5,
  },
  {
    id: 'sage-green',
    name: 'Зелёный',
    description: 'Спокойный, природный',
    previewEmoji: '🌿',
    bgClass: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    textColorClass: 'text-emerald-950',
    accentColorClass: 'text-emerald-600',
    fontClass: 'font-sans',
    slides: makeSlides(5),
    maxSlides: 10,
    defaultSlideCount: 5,
  },
  {
    id: 'noir',
    name: 'Нуар',
    description: 'Чёрный + красный акцент',
    previewEmoji: '🔴',
    bgClass: 'bg-black',
    textColorClass: 'text-white',
    accentColorClass: 'text-red-500',
    fontClass: 'font-sans',
    slides: makeSlides(5),
    maxSlides: 10,
    defaultSlideCount: 5,
  },
];

export type SlideData = Record<string, string>;

export function createEmptySlideData(slide: SlideTemplate): SlideData {
  const data: SlideData = {};
  for (const field of slide.fields) {
    data[field.id] = '';
  }
  return data;
}

export function createEmptySlidesData(template: CarouselTemplate): SlideData[] {
  return template.slides.map(createEmptySlideData);
}
