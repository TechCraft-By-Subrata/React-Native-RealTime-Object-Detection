export const REALTIME_DETECTION_THRESHOLD = 0.3;
export const REALTIME_SMALL_OBJECT_THRESHOLD = 0.2;
export const REALTIME_FURNITURE_THRESHOLD = 0.22;

export const SMALL_OBJECT_CLASSES = [
  'CELL_PHONE',
  'REMOTE',
  'BOOK',
  'CUP',
  'BOTTLE',
  'KEYBOARD',
  'MOUSE',
  'LAPTOP',
  'DINING_TABLE',
] as const;

export const FURNITURE_CLASSES = ['CHAIR', 'COUCH', 'DINING_TABLE', 'BENCH'] as const;

export const DETECTION_COLORS = [
  '#4dc3ff',
  '#ff7a59',
  '#7fd35a',
  '#f9c74f',
  '#c77dff',
  '#f94144',
  '#43aa8b',
  '#577590',
] as const;

export const MODEL_WARMUP_IMAGE =
  'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg';
