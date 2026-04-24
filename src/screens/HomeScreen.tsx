import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appStyles } from '../styles/appStyles';

type Props = {
  onOpenModel: () => void;
  onOpenScan: () => void;
  onOpenRealtime: () => void;
  isClassifierReady: boolean;
  isYoloReady: boolean;
};

export function HomeScreen({
  onOpenModel,
  onOpenScan,
  onOpenRealtime,
  isClassifierReady,
  isYoloReady,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[appStyles.homeContainer, { paddingTop: insets.top + 24 }]}>
      <Text style={appStyles.title}>On-Device Object Scanner</Text>
      <Text style={appStyles.subtitle}>Choose a screen to continue</Text>

      <View style={appStyles.card}>
        <Text style={appStyles.cardTitle}>Model Status</Text>
        <View style={appStyles.cardStatusRow}>
          <Text style={appStyles.cardStatusLabel}>Scan Model</Text>
          <Text style={appStyles.cardStatusValue}>{isClassifierReady ? 'Ready' : 'Loading'}</Text>
        </View>
        <View style={appStyles.cardStatusRow}>
          <Text style={appStyles.cardStatusLabel}>Realtime Model (YOLO26N)</Text>
          <Text style={appStyles.cardStatusValue}>{isYoloReady ? 'Ready' : 'Not Ready'}</Text>
        </View>
      </View>

      <Pressable style={appStyles.linkButton} onPress={onOpenModel}>
        <Text style={appStyles.linkButtonText}>1. Model Management</Text>
      </Pressable>

      <Pressable style={appStyles.linkButton} onPress={onOpenScan}>
        <Text style={appStyles.linkButtonText}>2. Scan Item</Text>
      </Pressable>

      <Pressable style={appStyles.linkButton} onPress={onOpenRealtime}>
        <Text style={appStyles.linkButtonText}>
          3. Realtime Detection {isYoloReady ? '' : '(Download YOLO26N first)'}
        </Text>
      </Pressable>
    </View>
  );
}
