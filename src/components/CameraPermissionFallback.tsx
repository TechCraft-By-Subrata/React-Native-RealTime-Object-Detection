import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';

type Props = {
  status: string;
  canRequestPermission: boolean;
  requestPermission: () => Promise<boolean>;
  requiredMessage: string;
};

export function CameraPermissionFallback({
  status,
  canRequestPermission,
  requestPermission,
  requiredMessage,
}: Props) {
  const isDenied = status === 'denied' && !canRequestPermission;

  const handlePermissionAction = async () => {
    if (isDenied) {
      await Linking.openSettings();
      return;
    }
    await requestPermission();
  };

  return (
    <View style={appStyles.centered}>
      <Text style={appStyles.permissionText}>
        {isDenied
          ? 'Camera permission is denied. Please enable it in app settings.'
          : requiredMessage}
      </Text>
      <Pressable style={appStyles.button} onPress={handlePermissionAction}>
        <Text style={appStyles.buttonText}>{isDenied ? 'Open Settings' : 'Grant Permission'}</Text>
      </Pressable>
    </View>
  );
}
