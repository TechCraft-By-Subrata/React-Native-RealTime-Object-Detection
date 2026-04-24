/**
 * Real-Time Object Detection POC
 * Uses react-native-vision-camera + react-native-executorch (EfficientNet)
 * to classify what the camera sees — entirely on-device.
 */

import React, { useMemo, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  EFFICIENTNET_V2_S,
  ObjectDetectionModule,
  YOLO26N,
  useClassification,
} from 'react-native-executorch';
import { MODEL_WARMUP_IMAGE } from './src/constants/realtimeDetection';
import { useDownloadedModels } from './src/hooks/useDownloadedModels';
import { HomeScreen } from './src/screens/HomeScreen';
import { ModelManagementScreen } from './src/screens/ModelManagementScreen';
import { RealtimeDetectionScreen } from './src/screens/RealtimeDetectionScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';

type ScreenName = 'home' | 'model' | 'scan' | 'realtime';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [isYoloReady, setIsYoloReady] = useState(false);

  const classifier = useClassification({ model: EFFICIENTNET_V2_S });
  const { downloadedModels } = useDownloadedModels({
    enabled: Platform.OS !== 'android',
    refreshDeps: [currentScreen],
  });

  const hasYoloDownloaded = useMemo(
    () => downloadedModels.some((path) => /yolo26n/i.test(path)),
    [downloadedModels],
  );
  const hasClassifierDownloaded = useMemo(
    () => downloadedModels.some((path) => /efficientnet_v2_s|efficientnet-v2-s/i.test(path)),
    [downloadedModels],
  );

  const classifierReady = classifier.isReady || hasClassifierDownloaded;
  const yoloReady = Platform.OS === 'android' ? true : isYoloReady || hasYoloDownloaded;

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
        <ScannerScreen onBack={() => setCurrentScreen('home')} classifier={classifier} />
      )}

      {currentScreen === 'realtime' && <RealtimeDetectionScreen onBack={() => setCurrentScreen('home')} />}
    </SafeAreaProvider>
  );
}
