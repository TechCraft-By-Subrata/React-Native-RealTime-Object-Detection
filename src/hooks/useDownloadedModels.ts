import { DependencyList, useCallback, useEffect, useState } from 'react';
import { BareResourceFetcher } from 'react-native-executorch-bare-resource-fetcher';

type Options = {
  enabled?: boolean;
  refreshDeps?: DependencyList;
};

export function useDownloadedModels(options: Options = {}) {
  const { enabled = true, refreshDeps = [] } = options;
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refreshDownloadedModels = useCallback(async () => {
    if (!enabled) return;

    try {
      setRefreshing(true);
      setError(null);
      const models = await BareResourceFetcher.listDownloadedModels();
      setDownloadedModels(models);
    } catch (err) {
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, [enabled]);

  useEffect(() => {
    refreshDownloadedModels();
  }, [refreshDownloadedModels, ...refreshDeps]);

  return {
    downloadedModels,
    refreshing,
    error,
    refreshDownloadedModels,
  };
}
