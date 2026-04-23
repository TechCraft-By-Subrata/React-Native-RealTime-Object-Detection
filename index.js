/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { initExecutorch } from 'react-native-executorch';
import { BareResourceFetcher } from 'react-native-executorch-bare-resource-fetcher';
import App from './App';
import { name as appName } from './app.json';

// Initialize ExecuTorch with the bare resource fetcher
initExecutorch({ resourceFetcher: BareResourceFetcher });

AppRegistry.registerComponent(appName, () => App);
