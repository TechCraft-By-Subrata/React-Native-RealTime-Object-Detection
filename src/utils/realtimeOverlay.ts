import { DETECTION_COLORS } from '../constants/realtimeDetection';
import { OverlayDetection, RawDetection } from '../types/detection';

type OverlayArgs = {
  detections: RawDetection[];
  frameWidth: number;
  frameHeight: number;
  screenWidth: number;
  screenHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function buildOverlayDetections({
  detections,
  frameWidth,
  frameHeight,
  screenWidth,
  screenHeight,
}: OverlayArgs): OverlayDetection[] {
  const maxCoord = detections.reduce((max, item) => {
    const localMax = Math.max(item.x1, item.y1, item.x2, item.y2);
    return localMax > max ? localMax : max;
  }, 0);

  const isNormalized = maxCoord > 0 && maxCoord <= 1.5;
  const srcWidth = Math.max(frameWidth, 1);
  const srcHeight = Math.max(frameHeight, 1);

  const coverScale = Math.max(screenWidth / srcWidth, screenHeight / srcHeight);
  const renderedWidth = srcWidth * coverScale;
  const renderedHeight = srcHeight * coverScale;
  const offsetX = (screenWidth - renderedWidth) / 2;
  const offsetY = (screenHeight - renderedHeight) / 2;

  return detections.slice(0, 8).map((item, index) => {
    const x1 = Math.min(item.x1, item.x2);
    const x2 = Math.max(item.x1, item.x2);
    const y1 = Math.min(item.y1, item.y2);
    const y2 = Math.max(item.y1, item.y2);

    const srcX1 = isNormalized ? x1 * srcWidth : x1;
    const srcX2 = isNormalized ? x2 * srcWidth : x2;
    const srcY1 = isNormalized ? y1 * srcHeight : y1;
    const srcY2 = isNormalized ? y2 * srcHeight : y2;

    const left = clamp(srcX1 * coverScale + offsetX, 0, screenWidth - 1);
    const right = clamp(srcX2 * coverScale + offsetX, 0, screenWidth - 1);
    const top = clamp(srcY1 * coverScale + offsetY, 0, screenHeight - 1);
    const bottom = clamp(srcY2 * coverScale + offsetY, 0, screenHeight - 1);

    return {
      id: `${item.label}-${index}-${Math.round(item.score * 1000)}`,
      left,
      top,
      width: Math.max(2, right - left),
      height: Math.max(2, bottom - top),
      label: item.label,
      score: item.score,
      color: DETECTION_COLORS[index % DETECTION_COLORS.length],
    };
  });
}

export function getTopDetectionLabel(detections: RawDetection[]): string {
  const top = detections[0];
  const readable = top.label.replace(/_/g, ' ').toLowerCase();
  return `${readable} (${(top.score * 100).toFixed(1)}%) · ${detections.length} item(s)`;
}
