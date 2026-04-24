import { DownloadedModelType } from '../types/detection';

export function detectModelType(path: string): DownloadedModelType {
  const lower = path.toLowerCase();
  if (lower.includes('yolo') || lower.includes('detr') || lower.includes('ssdlite')) {
    return 'detection';
  }
  if (lower.includes('efficientnet') || lower.includes('mobilenet') || lower.includes('resnet')) {
    return 'classification';
  }
  return 'other';
}

export function detectModelDisplayName(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('yolo26n')) return 'YOLO26N';
  if (lower.includes('efficientnet_v2_s') || lower.includes('efficientnet-v2-s')) {
    return 'EfficientNet V2 S';
  }
  if (lower.includes('ssdlite')) return 'SSDLite';
  if (lower.includes('rf-detr') || lower.includes('rfdetr')) return 'RF-DETR';

  return (path.split('/').pop() ?? path).replace(/_/g, ' ');
}
