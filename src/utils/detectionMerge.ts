import { RawDetection } from '../types/detection';

type ModelDetection = {
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  label: unknown;
  score: number;
};

function getIou(a: ModelDetection, b: ModelDetection): number {
  const ax1 = Math.min(a.bbox.x1, a.bbox.x2);
  const ay1 = Math.min(a.bbox.y1, a.bbox.y2);
  const ax2 = Math.max(a.bbox.x1, a.bbox.x2);
  const ay2 = Math.max(a.bbox.y1, a.bbox.y2);

  const bx1 = Math.min(b.bbox.x1, b.bbox.x2);
  const by1 = Math.min(b.bbox.y1, b.bbox.y2);
  const bx2 = Math.max(b.bbox.x1, b.bbox.x2);
  const by2 = Math.max(b.bbox.y1, b.bbox.y2);

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const interW = Math.max(0, ix2 - ix1);
  const interH = Math.max(0, iy2 - iy1);
  const inter = interW * interH;

  const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1));
  const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1));

  return inter / Math.max(1, areaA + areaB - inter);
}

export function mergeDetectionSets(
  baseDetections: ModelDetection[],
  auxiliaryDetections: ModelDetection[],
  iouThreshold = 0.75,
): ModelDetection[] {
  const merged = [...baseDetections];

  for (let i = 0; i < auxiliaryDetections.length; i += 1) {
    const extra = auxiliaryDetections[i];
    let exists = false;

    for (let j = 0; j < merged.length; j += 1) {
      const base = merged[j];
      if (String(base.label) !== String(extra.label)) continue;

      if (getIou(base, extra) > iouThreshold) {
        exists = true;
        if (extra.score > base.score) {
          merged[j] = extra;
        }
        break;
      }
    }

    if (!exists) {
      merged.push(extra);
    }
  }

  return merged;
}

export function serializeDetections(detections: ModelDetection[], limit = 16): RawDetection[] {
  return detections.slice(0, limit).map((det) => ({
    x1: det.bbox.x1,
    y1: det.bbox.y1,
    x2: det.bbox.x2,
    y2: det.bbox.y2,
    label: String(det.label),
    score: det.score,
  }));
}
