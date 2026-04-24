import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  type Frame,
  Templates,
  getCameraFormat,
  useCameraDevices,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import { useObjectDetection, YOLO26N } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';
import {
  FURNITURE_CLASSES,
  REALTIME_DETECTION_THRESHOLD,
  REALTIME_FURNITURE_THRESHOLD,
  REALTIME_SMALL_OBJECT_THRESHOLD,
  SMALL_OBJECT_CLASSES,
} from '../constants/realtimeDetection';
import { CameraPermissionFallback } from '../components/CameraPermissionFallback';
import { NoCameraFallback } from '../components/NoCameraFallback';
import { appStyles } from '../styles/appStyles';
import { withAlpha } from '../utils/color';
import { mergeDetectionSets, serializeDetections } from '../utils/detectionMerge';
import { buildOverlayDetections, getTopDetectionLabel } from '../utils/realtimeOverlay';
import { OverlayDetection, RawDetection } from '../types/detection';

type Props = {
  onBack: () => void;
};

export function RealtimeDetectionScreen({ onBack }: Props) {
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
  const lastTextRef = useRef('');
  const lastUpdateTsRef = useRef(0);
  const lastErrorLogTsRef = useRef(0);

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

  const handleNoDetection = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateTsRef.current < 500) return;

    lastUpdateTsRef.current = now;
    lastTextRef.current = 'No object detected';
    setLabel('No object detected');
    setOverlayDetections([]);
  }, []);

  const handleDetections = useCallback(
    (raw: RawDetection[], frameWidth: number, frameHeight: number) => {
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

      const mapped = buildOverlayDetections({
        detections: sorted,
        frameWidth,
        frameHeight,
        screenWidth,
        screenHeight,
      });

      const text = getTopDetectionLabel(sorted);
      if (text === lastTextRef.current && now - lastUpdateTsRef.current < 250) {
        setOverlayDetections(mapped);
        return;
      }

      lastTextRef.current = text;
      lastUpdateTsRef.current = now;
      setLabel(text);
      setOverlayDetections(mapped);
    },
    [handleNoDetection, screenHeight, screenWidth],
  );

  const detectorRunOnFrame = detector.runOnFrame;
  const detectorIsReady = detector.isReady;

  const handleFrameProcessingError = useCallback(
    (message: string) => {
      const now = Date.now();
      if (now - lastErrorLogTsRef.current < 1500) return;
      lastErrorLogTsRef.current = now;

      console.error('[Realtime][FrameError]', {
        message,
        platform: Platform.OS,
        detectorReady: detectorIsReady,
        detectorHasRunOnFrame: !!detectorRunOnFrame,
      });
    },
    [detectorIsReady, detectorRunOnFrame],
  );

  const frameOutput = useFrameOutput({
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    enablePreviewSizedOutputBuffers: true,
    onFrame: useCallback(
      (frame: Frame) => {
        'worklet';

        try {
          if (!detectorIsReady || !detectorRunOnFrame) {
            return;
          }

          const detections = detectorRunOnFrame(frame, false, {
            detectionThreshold: REALTIME_DETECTION_THRESHOLD,
            iouThreshold: 0.45,
            inputSize: 640,
          });
          const nearObjectDetections = detectorRunOnFrame(frame, false, {
            detectionThreshold: REALTIME_SMALL_OBJECT_THRESHOLD,
            iouThreshold: 0.45,
            inputSize: 640,
            classesOfInterest: SMALL_OBJECT_CLASSES as any,
          });
          const furnitureDetections = detectorRunOnFrame(frame, false, {
            detectionThreshold: REALTIME_FURNITURE_THRESHOLD,
            iouThreshold: 0.45,
            inputSize: 640,
            classesOfInterest: FURNITURE_CLASSES as any,
          });

          const merged = mergeDetectionSets(
            [...(detections ?? [])],
            [...(nearObjectDetections ?? []), ...(furnitureDetections ?? [])],
          );

          if (!merged.length) {
            scheduleOnRN(handleNoDetection);
            return;
          }

          const serializableDetections = serializeDetections(merged, 16);
          scheduleOnRN(handleDetections, serializableDetections, frame.height, frame.width);
        } catch (error) {
          const msg =
            typeof error === 'string'
              ? error
              : (error as { message?: string })?.message ?? 'frame processing error';

          scheduleOnRN(handleNoDetection);
          scheduleOnRN(handleFrameProcessingError, msg);
        } finally {
          frame.dispose();
        }
      },
      [
        detectorIsReady,
        detectorRunOnFrame,
        handleNoDetection,
        handleDetections,
        handleFrameProcessingError,
      ],
    ),
  });

  if (!hasPermission) {
    return (
      <CameraPermissionFallback
        status={status}
        canRequestPermission={canRequestPermission}
        requestPermission={requestPermission}
        requiredMessage="Camera permission is required for realtime detection."
      />
    );
  }

  if (!device) {
    return <NoCameraFallback />;
  }

  return (
    <View style={appStyles.container}>
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
              appStyles.detectionBox,
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
                appStyles.detectionTag,
                { borderColor: det.color, backgroundColor: withAlpha(det.color, 0.25) },
              ]}
            >
              <Text style={appStyles.detectionTagText}>
                {det.label.replace(/_/g, ' ').toLowerCase()} {(det.score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[appStyles.banner, { paddingTop: insets.top + 12 }]}>
        <Text style={appStyles.bannerText} numberOfLines={2}>
          {label}
        </Text>
      </View>

      <View style={[appStyles.controls, { paddingBottom: insets.bottom + 24 }]}>
        {!detector.isReady ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={appStyles.loadingHint}>
              Loading YOLO26N... {Math.round(detector.downloadProgress * 100)}%
            </Text>
          </>
        ) : (
          <Text style={appStyles.loadingHint}>Realtime detection is running.</Text>
        )}
      </View>

      <Pressable style={[appStyles.backFab, { top: insets.top + 12 }]} onPress={onBack}>
        <Text style={appStyles.backFabText}>Back</Text>
      </Pressable>
    </View>
  );
}
