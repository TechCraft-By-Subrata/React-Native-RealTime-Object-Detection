import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { useClassification } from 'react-native-executorch';
import { CameraPermissionFallback } from '../components/CameraPermissionFallback';
import { NoCameraFallback } from '../components/NoCameraFallback';
import { appStyles } from '../styles/appStyles';

type Props = {
  onBack: () => void;
  classifier: ReturnType<typeof useClassification>;
};

export function ScannerScreen({ onBack, classifier }: Props) {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission, status, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ containerFormat: 'jpeg' });

  const [label, setLabel] = useState('Point camera at any object and tap Scan');
  const [scanning, setScanning] = useState(false);

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

      const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
      const filePath = await photo.saveToTemporaryFileAsync(85);

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

      const top = Object.entries(results).sort(([, a], [, b]) => b - a)[0];
      if (top) {
        const [topLabel, score] = top;
        setLabel(`${topLabel} (${(score * 100).toFixed(1)}%)`);
      } else {
        setLabel('Could not classify — try again');
      }
    } catch (error) {
      console.error(error);
      setLabel('Error classifying image');
    } finally {
      setScanning(false);
    }
  };

  if (!hasPermission) {
    return (
      <CameraPermissionFallback
        status={status}
        canRequestPermission={canRequestPermission}
        requestPermission={requestPermission}
        requiredMessage="Camera permission is required to scan items."
      />
    );
  }

  if (!device) {
    return <NoCameraFallback />;
  }

  return (
    <View style={appStyles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={[photoOutput]} />

      <View style={[appStyles.banner, { paddingTop: insets.top + 12 }]}>
        <Text style={appStyles.bannerText} numberOfLines={2}>
          {label}
        </Text>
      </View>

      <View style={[appStyles.controls, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={[
            appStyles.scanButton,
            (scanning || !classifier.isReady) && appStyles.scanButtonDisabled,
          ]}
          onPress={handleScan}
          disabled={scanning || !classifier.isReady}
        >
          {scanning || !classifier.isReady ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={appStyles.scanButtonText}>{classifier.isReady ? 'Scan' : 'Loading model...'}</Text>
          )}
        </Pressable>
        {!classifier.isReady && <Text style={appStyles.loadingHint}>Downloading model on first run…</Text>}
      </View>

      <Pressable style={[appStyles.backFab, { top: insets.top + 12 }]} onPress={onBack}>
        <Text style={appStyles.backFabText}>Back</Text>
      </Pressable>
    </View>
  );
}
