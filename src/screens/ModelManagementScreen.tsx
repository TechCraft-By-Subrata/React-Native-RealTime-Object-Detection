import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDownloadedModels } from '../hooks/useDownloadedModels';
import { appStyles } from '../styles/appStyles';
import { detectModelDisplayName, detectModelType } from '../utils/modelMetadata';

type Props = {
  onBack: () => void;
  isClassifierReady: boolean;
  isYoloReady: boolean;
  onPrepareYoloModel: () => Promise<void>;
};

export function ModelManagementScreen({
  onBack,
  isClassifierReady,
  isYoloReady,
  onPrepareYoloModel,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busyAction, setBusyAction] = useState<'yolo' | null>(null);
  const [message, setMessage] = useState('Scan model loads automatically in Scan Item screen.');
  const { downloadedModels, refreshing, error, refreshDownloadedModels } = useDownloadedModels();

  const hasYoloDownloaded = downloadedModels.some((path) => /yolo26n/i.test(path));
  const yoloAvailable = isYoloReady || hasYoloDownloaded;

  const downloadedModelCards = useMemo(
    () =>
      downloadedModels.map((path) => ({
        path,
        fileName: path.split('/').pop() ?? path,
        displayName: detectModelDisplayName(path),
        type: detectModelType(path),
      })),
    [downloadedModels],
  );

  useEffect(() => {
    if (!error) return;
    console.error(error);
    setMessage('Could not read downloaded models list.');
  }, [error]);

  const handlePrepareYolo = async () => {
    if (busyAction) return;

    try {
      setBusyAction('yolo');
      setMessage('Downloading and warming up YOLO26N...');
      await onPrepareYoloModel();
      await refreshDownloadedModels();
      setMessage('YOLO26N is ready. You can open Realtime Detection.');
    } catch (err) {
      console.error(err);
      setMessage('Could not prepare YOLO26N. Check internet and try again.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View style={[appStyles.screenContainer, { paddingTop: insets.top + 16 }]}>
      <Text style={appStyles.screenTitle}>Model Management</Text>
      <Text style={appStyles.screenBody}>
        Scan Model: {isClassifierReady ? 'Ready' : 'Loads automatically in Scan Item'}
      </Text>
      <Text style={appStyles.screenBody}>
        Realtime Model (YOLO26N): {yoloAvailable ? 'Ready' : 'Not ready'}
      </Text>
      <Text style={appStyles.screenHint}>{message}</Text>

      <View style={appStyles.modelsCard}>
        <Text style={appStyles.modelsTitle}>Downloaded Models</Text>
        {!refreshing && downloadedModels.length > 0 && (
          <Text style={appStyles.modelsSummary}>{downloadedModels.length} model(s) downloaded</Text>
        )}

        {refreshing ? (
          <Text style={appStyles.modelsEmpty}>Refreshing...</Text>
        ) : downloadedModels.length === 0 ? (
          <Text style={appStyles.modelsEmpty}>No models downloaded yet.</Text>
        ) : (
          <ScrollView
            style={appStyles.modelsList}
            contentContainerStyle={appStyles.modelsListContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {downloadedModelCards.map((model) => (
              <View key={model.path} style={appStyles.modelRow}>
                <View style={appStyles.modelHeaderRow}>
                  <Text style={appStyles.modelName}>{model.displayName}</Text>
                  <Text style={appStyles.modelBadge}>{model.type.toUpperCase()}</Text>
                </View>
                <Text numberOfLines={2} style={appStyles.modelFile}>
                  {model.fileName}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <Pressable
        style={[appStyles.refreshButton, refreshing && appStyles.actionButtonDisabled]}
        onPress={refreshDownloadedModels}
        disabled={refreshing}
      >
        <Text style={appStyles.refreshButtonText}>Refresh Downloaded Models</Text>
      </Pressable>

      {!yoloAvailable ? (
        <>
          <Text style={appStyles.screenHint}>
            Realtime Detection needs YOLO26N model. It is not ready yet.
          </Text>
          <Pressable
            style={[appStyles.actionButton, !!busyAction && appStyles.actionButtonDisabled]}
            onPress={handlePrepareYolo}
            disabled={!!busyAction}
          >
            {busyAction === 'yolo' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={appStyles.actionButtonText}>Download YOLO26N</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Text style={appStyles.screenHint}>YOLO26N is downloaded and ready for Realtime Detection.</Text>
      )}

      <Pressable style={appStyles.secondaryButton} onPress={onBack}>
        <Text style={appStyles.secondaryButtonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}
