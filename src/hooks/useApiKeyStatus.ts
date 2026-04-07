import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import type { UserSettingsStatusResponse } from '../shared/types';

export function useApiKeyStatus() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await apiRequest<UserSettingsStatusResponse>('/api/user-settings/status');
      setHasApiKey(response.hasApiKey);
      setUserId(response.userId);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    hasApiKey,
    isLoading,
    userId,
    refresh,
  };
}
