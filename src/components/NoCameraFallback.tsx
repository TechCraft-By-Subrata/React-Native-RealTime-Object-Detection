import React from 'react';
import { Text, View } from 'react-native';
import { appStyles } from '../styles/appStyles';

export function NoCameraFallback() {
  return (
    <View style={appStyles.centered}>
      <Text style={appStyles.permissionText}>No camera device found.</Text>
    </View>
  );
}
