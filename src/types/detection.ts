export type DownloadedModelType = 'classification' | 'detection' | 'other';

export type RawDetection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  score: number;
};

export type OverlayDetection = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  score: number;
  color: string;
};
