/**
 * Real-Time Object Detection POC
 * Uses react-native-vision-camera + react-native-executorch (EfficientNet)
 * to classify what the camera sees — entirely on-device.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  useWindowDimensions,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  getCameraFormat,
  Templates,
  useCameraDevices,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  useFrameOutput,
} from 'react-native-vision-camera';
import {
  useClassification,
  useObjectDetection,
  EFFICIENTNET_V2_S,
  YOLO26N,
  ObjectDetectionModule,
} from 'react-native-executorch';
import { BareResourceFetcher } from 'react-native-executorch-bare-resource-fetcher';
import { scheduleOnRN } from 'react-native-worklets';

type ScreenName = 'home' | 'model' | 'scan' | 'realtime';
type DownloadedModelType = 'classification' | 'detection' | 'other';
type RawDetection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  score: number;
};
type OverlayDetection = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  score: number;
  color: string;
};
const REALTIME_DETECTION_THRESHOLD = 0.3;
const REALTIME_SMALL_OBJECT_THRESHOLD = 0.2;
const REALTIME_FURNITURE_THRESHOLD = 0.22;
const SMALL_OBJECT_CLASSES = [
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
const FURNITURE_CLASSES = [
  'CHAIR',
  'COUCH',
  'DINING_TABLE',
  'BENCH',
] as const;
const DETECTION_COLORS = [
  '#4dc3ff',
  '#ff7a59',
  '#7fd35a',
  '#f9c74f',
  '#c77dff',
  '#f94144',
  '#43aa8b',
  '#577590',
] as const;

function withAlpha(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) return `rgba(77,195,255,${alpha})`;
  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const MODEL_WARMUP_IMAGE = 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg';

function detectModelType(path: string): DownloadedModelType {
  const lower = path.toLowerCase();
  if (lower.includes('yolo') || lower.includes('detr') || lower.includes('ssdlite')) {
    return 'detection';
  }
  if (lower.includes('efficientnet') || lower.includes('mobilenet') || lower.includes('resnet')) {
    return 'classification';
  }
  return 'other';
}

function detectModelDisplayName(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes('yolo26n')) return 'YOLO26N';
  if (lower.includes('efficientnet_v2_s') || lower.includes('efficientnet-v2-s')) {
    return 'EfficientNet V2 S';
  }
  if (lower.includes('ssdlite')) return 'SSDLite';
  if (lower.includes('rf-detr') || lower.includes('rfdetr')) return 'RF-DETR';
  return (path.split('/').pop() ?? path).replace(/_/g, ' ');
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [isYoloReady, setIsYoloReady] = useState(false);
  const [hasYoloDownloaded, setHasYoloDownloaded] = useState(false);
  const [hasClassifierDownloaded, setHasClassifierDownloaded] = useState(false);
  const classifier = useClassification({ model: EFFICIENTNET_V2_S });
  const classifierReady = classifier.isReady || hasClassifierDownloaded;
  const yoloReady = Platform.OS === 'android' ? true : (isYoloReady || hasYoloDownloaded);

  useEffect(() => {
    if (Platform.OS === 'android') return;
    let isMounted = true;
    (async () => {
      try {
        const models = await BareResourceFetcher.listDownloadedModels();
        if (!isMounted) return;
        setHasYoloDownloaded(models.some((path) => /yolo26n/i.test(path)));
        setHasClassifierDownloaded(
          models.some((path) => /efficientnet_v2_s|efficientnet-v2-s/i.test(path))
        );
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [currentScreen]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {currentScreen === 'home' && (
        <HomeScreen
          onOpenModel={() => setCurrentScreen('model')}
          onOpenScan={() => setCurrentScreen('scan')}
          onOpenRealtime={() => setCurrentScreen('realtime')}
          isClassifierReady={classifierReady}
          isYoloReady={yoloReady}
        />
      )}
      {currentScreen === 'model' && (
        <ModelManagementScreen
          onBack={() => setCurrentScreen('home')}
          isClassifierReady={classifierReady}
          isYoloReady={yoloReady}
          onPrepareYoloModel={async () => {
            const detector = await ObjectDetectionModule.fromModelName(YOLO26N);
            await detector.forward(MODEL_WARMUP_IMAGE);
            setIsYoloReady(true);
          }}
        />
      )}
      {currentScreen === 'scan' && (
        <ScannerScreen
          onBack={() => setCurrentScreen('home')}
          classifier={classifier}
        />
      )}
      {currentScreen === 'realtime' && (
        <RealtimeDetectionScreen
          onBack={() => setCurrentScreen('home')}
          isYoloReady={isYoloReady}
          onOpenModelManagement={() => setCurrentScreen('model')}
        />
      )}
    </SafeAreaProvider>
  );
}

function HomeScreen({
  onOpenModel,
  onOpenScan,
  onOpenRealtime,
  isClassifierReady,
  isYoloReady,
}: {
  onOpenModel: () => void;
  onOpenScan: () => void;
  onOpenRealtime: () => void;
  isClassifierReady: boolean;
  isYoloReady: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.homeContainer, { paddingTop: insets.top + 24 }]}> 
      <Text style={styles.title}>On-Device Object Scanner</Text>
      <Text style={styles.subtitle}>Choose a screen to continue</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Model Status</Text>
        <View style={styles.cardStatusRow}>
          <Text style={styles.cardStatusLabel}>Scan Model</Text>
          <Text style={styles.cardStatusValue}>{isClassifierReady ? 'Ready' : 'Loading'}</Text>
        </View>
        <View style={styles.cardStatusRow}>
          <Text style={styles.cardStatusLabel}>Realtime Model (YOLO26N)</Text>
          <Text style={styles.cardStatusValue}>{isYoloReady ? 'Ready' : 'Not Ready'}</Text>
        </View>
      </View>

      <Pressable style={styles.linkButton} onPress={onOpenModel}>
        <Text style={styles.linkButtonText}>1. Model Management</Text>
      </Pressable>

      <Pressable style={styles.linkButton} onPress={onOpenScan}>
        <Text style={styles.linkButtonText}>2. Scan Item</Text>
      </Pressable>

      <Pressable style={styles.linkButton} onPress={onOpenRealtime}>
        <Text style={styles.linkButtonText}>
          3. Realtime Detection {isYoloReady ? '' : '(Download YOLO26N first)'}
        </Text>
      </Pressable>
    </View>
  );
}

function ModelManagementScreen({
  onBack,
  isClassifierReady,
  isYoloReady,
  onPrepareYoloModel,
}: {
  onBack: () => void;
  isClassifierReady: boolean;
  isYoloReady: boolean;
  onPrepareYoloModel: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [busyAction, setBusyAction] = useState<'yolo' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('Scan model loads automatically in Scan Item screen.');
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const hasYoloDownloaded = downloadedModels.some((path) => /yolo26n/i.test(path));
  const yoloAvailable = isYoloReady || hasYoloDownloaded;
  const downloadedModelCards = downloadedModels.map((path) => ({
    path,
    fileName: path.split('/').pop() ?? path,
    displayName: detectModelDisplayName(path),
    type: detectModelType(path),
  }));

  const refreshDownloadedModels = async () => {
    try {
      setRefreshing(true);
      const models = await BareResourceFetcher.listDownloadedModels();
      setDownloadedModels(models);
    } catch (error) {
      console.error(error);
      setMessage('Could not read downloaded models list.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshDownloadedModels();
  }, []);

  const handlePrepareYolo = async () => {
    if (busyAction) return;
    try {
      setBusyAction('yolo');
      setMessage('Downloading and warming up YOLO26N...');
      await onPrepareYoloModel();
      await refreshDownloadedModels();
      setMessage('YOLO26N is ready. You can open Realtime Detection.');
    } catch (error) {
      console.error(error);
      setMessage('Could not prepare YOLO26N. Check internet and try again.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top + 16 }]}> 
      <Text style={styles.screenTitle}>Model Management</Text>
      <Text style={styles.screenBody}>
        Scan Model: {isClassifierReady ? 'Ready' : 'Loads automatically in Scan Item'}
      </Text>
      <Text style={styles.screenBody}>Realtime Model (YOLO26N): {yoloAvailable ? 'Ready' : 'Not ready'}</Text>
      <Text style={styles.screenHint}>{message}</Text>

      <View style={styles.modelsCard}>
        <Text style={styles.modelsTitle}>Downloaded Models</Text>
        {!refreshing && downloadedModels.length > 0 && (
          <Text style={styles.modelsSummary}>{downloadedModels.length} model(s) downloaded</Text>
        )}
        {refreshing ? (
          <Text style={styles.modelsEmpty}>Refreshing...</Text>
        ) : downloadedModels.length === 0 ? (
          <Text style={styles.modelsEmpty}>No models downloaded yet.</Text>
        ) : (
          <ScrollView
            style={styles.modelsList}
            contentContainerStyle={styles.modelsListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {downloadedModelCards.map((model) => {
              return (
                <View key={model.path} style={styles.modelRow}>
                  <View style={styles.modelHeaderRow}>
                    <Text style={styles.modelName}>{model.displayName}</Text>
                    <Text style={styles.modelBadge}>{model.type.toUpperCase()}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.modelFile}>
                    {model.fileName}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <Pressable
        style={[styles.refreshButton, refreshing && styles.actionButtonDisabled]}
        onPress={refreshDownloadedModels}
        disabled={refreshing}
      >
        <Text style={styles.refreshButtonText}>Refresh Downloaded Models</Text>
      </Pressable>

      {!yoloAvailable ? (
        <>
          <Text style={styles.screenHint}>
            Realtime Detection needs YOLO26N model. It is not ready yet.
          </Text>
          <Pressable
            style={[styles.actionButton, !!busyAction && styles.actionButtonDisabled]}
            onPress={handlePrepareYolo}
            disabled={!!busyAction}
          >
            {busyAction === 'yolo' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Download YOLO26N</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Text style={styles.screenHint}>YOLO26N is downloaded and ready for Realtime Detection.</Text>
      )}

      <Pressable style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

function RealtimeDetectionScreen({
  onBack,
  isYoloReady: _isYoloReady,
  onOpenModelManagement: _onOpenModelManagement,
}: {
  onBack: () => void;
  isYoloReady: boolean;
  onOpenModelManagement: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { hasPermission, requestPermission, status, canRequestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'back') ?? devices[0];
  const format = useMemo(() => {
    if (device == null) return undefined;
    try {
      return getCameraFormat(device, { ...Templates.FrameProcessing });
    } catch {
      return undefined;
    }
  }, [device]);
  const detector = useObjectDetection({ model: YOLO26N });
  const [label, setLabel] = useState('Waiting for detections...');
  const [overlayDetections, setOverlayDetections] = useState<OverlayDetection[]>([]);
  const lastTextRef = useRef<string>('');
  const lastUpdateTsRef = useRef<number>(0);
  const lastErrorLogTsRef = useRef<number>(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  useEffect(() => {
    if (!detector.error) return;
    console.error('[Realtime][DetectorError]', {
      error: String(detector.error),
      platform: Platform.OS,
      isReady: detector.isReady,
      downloadProgress: detector.downloadProgress,
    });
    setLabel(`Realtime detection unavailable: ${String(detector.error)}`);
    setOverlayDetections([]);
  }, [detector.downloadProgress, detector.error, detector.isReady]);

  const handleDetections = useCallback((raw: RawDetection[], frameWidth: number, frameHeight: number) => {
    if (!Array.isArray(raw) || raw.length === 0) {
      handleNoDetection();
      return;
    }

    const now = Date.now();
    if (now - lastUpdateTsRef.current < 120) return;

    const sorted = [...raw].sort((a, b) => b.score - a.score);
    if (!sorted.length) {
      lastUpdateTsRef.current = now;
      lastTextRef.current = 'No object detected';
      setLabel('No object detected');
      setOverlayDetections([]);
      return;
    }

    const maxCoord = sorted.reduce((max, item) => {
      const localMax = Math.max(item.x1, item.y1, item.x2, item.y2);
      return localMax > max ? localMax : max;
    }, 0);

    const isNormalized = maxCoord > 0 && maxCoord <= 1.5;
    const srcWidth = Math.max(frameWidth, 1);
    const srcHeight = Math.max(frameHeight, 1);

    // Camera preview uses aspect-fill. Project detection coordinates through
    // the same cover transform to keep boxes aligned on-screen.
    const coverScale = Math.max(screenWidth / srcWidth, screenHeight / srcHeight);
    const renderedWidth = srcWidth * coverScale;
    const renderedHeight = srcHeight * coverScale;
    const offsetX = (screenWidth - renderedWidth) / 2;
    const offsetY = (screenHeight - renderedHeight) / 2;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

    const mapped = sorted.slice(0, 8).map((item, index) => {
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
      const width = Math.max(2, right - left);
      const height = Math.max(2, bottom - top);
      const color = DETECTION_COLORS[index % DETECTION_COLORS.length];

      return {
        id: `${item.label}-${index}-${Math.round(item.score * 1000)}`,
        left,
        top,
        width,
        height,
        label: item.label,
        score: item.score,
        color,
      } satisfies OverlayDetection;
    });

    const topDet = sorted[0];
    const readable = topDet.label.replace(/_/g, ' ').toLowerCase();
    const text = `${readable} (${(topDet.score * 100).toFixed(1)}%) · ${sorted.length} item(s)`;
    if (text === lastTextRef.current && now - lastUpdateTsRef.current < 250) {
      setOverlayDetections(mapped);
      return;
    }
    lastTextRef.current = text;
    lastUpdateTsRef.current = now;
    setLabel(text);
    setOverlayDetections(mapped);
  }, [screenHeight, screenWidth]);

  const handleNoDetection = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTsRef.current < 500) return;
    lastUpdateTsRef.current = now;
    lastTextRef.current = 'No object detected';
    setLabel('No object detected');
    setOverlayDetections([]);
  }, []);

  const handleFrameProcessingError = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastErrorLogTsRef.current < 1500) return;
    lastErrorLogTsRef.current = now;
    console.error('[Realtime][FrameError]', {
      message,
      platform: Platform.OS,
      detectorReady: detectorIsReady,
      detectorHasRunOnFrame: !!detRof,
    });
  }, []);

  // Extract runOnFrame before the worklet — capturing the full detector object
  // across the JS/worklet boundary causes "Failed to create a worklet".
  const detRof = detector.runOnFrame;
  const detectorIsReady = detector.isReady;

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    enablePreviewSizedOutputBuffers: true,
    onFrame: useCallback((frame) => {
      'worklet';
      try {
        if (!detectorIsReady || !detRof) {
          return;
        }
        const detections = detRof(frame, false, {
          detectionThreshold: REALTIME_DETECTION_THRESHOLD,
          iouThreshold: 0.45,
          inputSize: 640,
        });
        const nearObjectDetections = detRof(frame, false, {
          detectionThreshold: REALTIME_SMALL_OBJECT_THRESHOLD,
          iouThreshold: 0.45,
          inputSize: 640,
          classesOfInterest: SMALL_OBJECT_CLASSES as unknown as string[],
        });
        const furnitureDetections = detRof(frame, false, {
          detectionThreshold: REALTIME_FURNITURE_THRESHOLD,
          iouThreshold: 0.45,
          inputSize: 640,
          classesOfInterest: FURNITURE_CLASSES as unknown as string[],
        });
        const merged = [...(detections ?? [])];
        const auxiliaryDetections = [
          ...(nearObjectDetections ?? []),
          ...(furnitureDetections ?? []),
        ];
        if (auxiliaryDetections.length > 0) {
          for (let i = 0; i < auxiliaryDetections.length; i += 1) {
            const extra = auxiliaryDetections[i];
            let exists = false;
            for (let j = 0; j < merged.length; j += 1) {
              const base = merged[j];
              if (String(base.label) !== String(extra.label)) continue;

              const ax1 = Math.min(base.bbox.x1, base.bbox.x2);
              const ay1 = Math.min(base.bbox.y1, base.bbox.y2);
              const ax2 = Math.max(base.bbox.x1, base.bbox.x2);
              const ay2 = Math.max(base.bbox.y1, base.bbox.y2);

              const bx1 = Math.min(extra.bbox.x1, extra.bbox.x2);
              const by1 = Math.min(extra.bbox.y1, extra.bbox.y2);
              const bx2 = Math.max(extra.bbox.x1, extra.bbox.x2);
              const by2 = Math.max(extra.bbox.y1, extra.bbox.y2);

              const ix1 = Math.max(ax1, bx1);
              const iy1 = Math.max(ay1, by1);
              const ix2 = Math.min(ax2, bx2);
              const iy2 = Math.min(ay2, by2);
              const iw = Math.max(0, ix2 - ix1);
              const ih = Math.max(0, iy2 - iy1);
              const inter = iw * ih;
              const areaA = Math.max(1, (ax2 - ax1) * (ay2 - ay1));
              const areaB = Math.max(1, (bx2 - bx1) * (by2 - by1));
              const iou = inter / Math.max(1, areaA + areaB - inter);

              if (iou > 0.75) {
                exists = true;
                if (extra.score > base.score) {
                  merged[j] = extra;
                }
                break;
              }
            }
            if (!exists) merged.push(extra);
          }
        }
        if (!merged.length) {
          scheduleOnRN(handleNoDetection);
          return;
        }
        const serializableDetections = merged.slice(0, 16).map((det) => ({
          x1: det.bbox.x1,
          y1: det.bbox.y1,
          x2: det.bbox.x2,
          y2: det.bbox.y2,
          label: String(det.label),
          score: det.score,
        }));
        // Camera sensor frames are landscape-native, swap dimensions for portrait UI mapping.
        scheduleOnRN(handleDetections, serializableDetections, frame.height, frame.width);
      } catch (error) {
        const msg = typeof error === 'string'
          ? error
          : (error as { message?: string })?.message ?? 'frame processing error';
        // Per-frame worklet errors can be transient while camera/session settles.
        // Keep UI in "no detection" state unless detector.error reports a real failure.
        scheduleOnRN(handleNoDetection);
        scheduleOnRN(handleFrameProcessingError, msg);
      } finally {
        frame.dispose();
      }
    }, [detectorIsReady, detRof, handleNoDetection, handleDetections, handleFrameProcessingError]),
  });

  if (!hasPermission) {
    const isDenied = status === 'denied' && !canRequestPermission;
    const handlePermissionAction = async () => {
      if (isDenied) {
        await Linking.openSettings();
        return;
      }
      await requestPermission();
    };
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          {isDenied
            ? 'Camera permission is denied. Please enable it in app settings.'
            : 'Camera permission is required for realtime detection.'}
        </Text>
        <Pressable style={styles.button} onPress={handlePermissionAction}>
          <Text style={styles.buttonText}>{isDenied ? 'Open Settings' : 'Grant Permission'}</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[frameOutput]}
        format={format}
        orientationSource="device"
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {overlayDetections.map((det) => (
          <View
            key={det.id}
            style={[
              styles.detectionBox,
              {
                left: det.left,
                top: det.top,
                width: det.width,
                height: det.height,
                borderColor: det.color,
                backgroundColor: withAlpha(det.color, 0.12),
              },
            ]}
          >
            <View
              style={[
                styles.detectionTag,
                { borderColor: det.color, backgroundColor: withAlpha(det.color, 0.25) },
              ]}
            >
              <Text style={styles.detectionTagText}>
                {det.label.replace(/_/g, ' ').toLowerCase()} {(det.score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.banner, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.bannerText} numberOfLines={2}>
          {label}
        </Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        {!detector.isReady ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingHint}>
              Loading YOLO26N... {Math.round(detector.downloadProgress * 100)}%
            </Text>
          </>
        ) : (
          <Text style={styles.loadingHint}>Realtime detection is running.</Text>
        )}
      </View>

      <Pressable style={[styles.backFab, { top: insets.top + 12 }]} onPress={onBack}>
        <Text style={styles.backFabText}>Back</Text>
      </Pressable>
    </View>
  );
}

function ScannerScreen({
  onBack,
  classifier,
}: {
  onBack: () => void;
  classifier: ReturnType<typeof useClassification>;
}) {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission, status, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg' });

  const [label, setLabel] = useState<string>('Point camera at any object and tap Scan');
  const [scanning, setScanning] = useState(false);

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const handleScan = async () => {
    if (scanning || !classifier.isReady) return;

    try {
      setScanning(true);
      setLabel('Classifying…');

      // Capture a still frame
      const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
      const filePath = await photo.saveToTemporaryFileAsync(85);

      // ExecuTorch image readers can differ by platform/build, so try both
      // native path and file:// URI forms before failing.
      const candidateSources = filePath.startsWith('file://')
        ? [filePath, filePath.replace(/^file:\/\//, '')]
        : [filePath, `file://${filePath}`];

      let results: Record<string, number> | null = null;
      let lastError: unknown = null;

      for (const source of candidateSources) {
        try {
          results = await classifier.forward(source);
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!results) {
        throw lastError ?? new Error('Failed to read image from captured path');
      }

      // Pick the highest-confidence class
      const top = Object.entries(results)
        .sort(([, a], [, b]) => b - a)[0];

      if (top) {
        const [topLabel, score] = top;
        setLabel(`${topLabel} (${(score * 100).toFixed(1)}%)`);
      } else {
        setLabel('Could not classify — try again');
      }
    } catch (err) {
      console.error(err);
      setLabel('Error classifying image');
    } finally {
      setScanning(false);
    }
  };

  // ── Permission not granted ──────────────────────────────────────────────
  if (!hasPermission) {
    const isDenied = status === 'denied' && !canRequestPermission;
    const handlePermissionAction = async () => {
      if (isDenied) {
        await Linking.openSettings();
        return;
      }
      await requestPermission();
    };
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          {isDenied
            ? 'Camera permission is denied. Please enable it in app settings.'
            : 'Camera permission is required to scan items.'}
        </Text>
        <Pressable style={styles.button} onPress={handlePermissionAction}>
          <Text style={styles.buttonText}>{isDenied ? 'Open Settings' : 'Grant Permission'}</Text>
        </Pressable>
      </View>
    );
  }

  // ── No back camera found ────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>No camera device found.</Text>
      </View>
    );
  }

  // ── Main UI ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        outputs={[photoOutput]}
      />

      {/* Result banner */}
      <View style={[styles.banner, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.bannerText} numberOfLines={2}>
          {label}
        </Text>
      </View>

      {/* Scan button */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={[styles.scanButton, (scanning || !classifier.isReady) && styles.scanButtonDisabled]}
          onPress={handleScan}
          disabled={scanning || !classifier.isReady}
        >
          {scanning || !classifier.isReady ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>
              {classifier.isReady ? 'Scan' : 'Loading model...'}
            </Text>
          )}
        </Pressable>
        {!classifier.isReady && (
          <Text style={styles.loadingHint}>Downloading model on first run…</Text>
        )}
      </View>

      <Pressable style={[styles.backFab, { top: insets.top + 12 }]} onPress={onBack}>
        <Text style={styles.backFabText}>Back</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    paddingHorizontal: 20,
    gap: 14,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: '#a6b4d0',
    fontSize: 16,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#121a30',
    borderWidth: 1,
    borderColor: '#1f2a48',
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#8aa0d2',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  cardStatusLabel: {
    color: '#d7e3ff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cardStatusValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    paddingHorizontal: 20,
  },
  screenTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  screenBody: {
    color: '#dbe7ff',
    fontSize: 16,
    marginBottom: 8,
  },
  screenHint: {
    color: '#9fb2d8',
    fontSize: 14,
    marginBottom: 20,
  },
  modelsCard: {
    backgroundColor: '#121a30',
    borderWidth: 1,
    borderColor: '#1f2a48',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    maxHeight: 300,
    overflow: 'hidden',
  },
  modelsList: {
    maxHeight: 220,
  },
  modelsListContent: {
    paddingBottom: 4,
  },
  modelsTitle: {
    color: '#dbe7ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  modelsSummary: {
    color: '#9fb2d8',
    fontSize: 12,
    marginBottom: 10,
  },
  modelsEmpty: {
    color: '#9fb2d8',
    fontSize: 13,
  },
  modelRow: {
    backgroundColor: '#0d1428',
    borderWidth: 1,
    borderColor: '#23335a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modelName: {
    color: '#e8f0ff',
    fontSize: 13,
    fontWeight: '700',
  },
  modelBadge: {
    color: '#8fb6ff',
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#3d62a8',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modelFile: {
    color: '#b8c7e6',
    fontSize: 11,
    lineHeight: 16,
  },
  refreshButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3b62',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  refreshButtonText: {
    color: '#dbe7ff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#1a73e8',
    minHeight: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    backgroundColor: '#51607a',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a3b62',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#dbe7ff',
    fontSize: 15,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Result banner at the top
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  bannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Scan button at the bottom
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 16,
  },
  scanButton: {
    backgroundColor: '#1a73e8',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  scanButtonDisabled: {
    backgroundColor: '#555',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingHint: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 8,
  },
  backFab: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3d3d3d',
  },
  backFabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4dc3ff',
    borderRadius: 6,
    backgroundColor: 'rgba(77,195,255,0.08)',
  },
  detectionTag: {
    position: 'absolute',
    top: -24,
    left: 0,
    backgroundColor: 'rgba(20,30,45,0.85)',
    borderWidth: 1,
    borderColor: '#4dc3ff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 180,
  },
  detectionTagText: {
    color: '#dff5ff',
    fontSize: 11,
    fontWeight: '700',
  },
});
