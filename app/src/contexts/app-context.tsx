import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { gapi } from 'gapi-script';
import { hashEmail } from '../utils/fileSharing';
import apiClient from '../utils/apiClient';

// Cache configuration
const CACHE_KEYS = {
  CREDITS: 'zerodrive-credits-cache',
  STORAGE: 'zerodrive-storage-cache',
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = <T,>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
};

const setCachedData = <T,>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

interface AppContextType {
  userEmail: string;
  userName: string;
  userImage: string;
  creditBalance: number | null;
  storageInfo: { used: number; total: number } | null;
  isLoadingStorage: boolean;
  isLoadingCredits: boolean;
  hasDecryptionError: boolean;
  setDecryptionError: (hasError: boolean) => void;
  refreshCredits: () => Promise<void>;
  refreshStorage: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setUserInfo: (email: string, name?: string, image?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userImage, setUserImage] = useState('');
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    total: number;
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [hasDecryptionError, setHasDecryptionError] = useState(false);

  const setDecryptionError = useCallback((hasError: boolean) => {
    setHasDecryptionError(hasError);
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!userEmail) return;

    // Load from cache immediately
    const cached = getCachedData<number>(CACHE_KEYS.CREDITS);
    if (cached !== null) {
      setCreditBalance(cached);
    }

    setIsLoadingCredits(true);
    try {
      const hashedEmail = await hashEmail(userEmail);
      const balanceData = await apiClient.credits.getBalance(hashedEmail);
      setCreditBalance(balanceData.balance);
      setCachedData(CACHE_KEYS.CREDITS, balanceData.balance);
    } catch (error) {
      console.error('[AppContext] Error fetching credit balance:', error);
      // Keep cached value if API fails
    } finally {
      setIsLoadingCredits(false);
    }
  }, [userEmail]);

  const refreshStorage = useCallback(async () => {
    // Load from cache immediately
    const cached = getCachedData<{ used: number; total: number }>(CACHE_KEYS.STORAGE);
    if (cached) {
      setStorageInfo(cached);
    }

    setIsLoadingStorage(true);
    try {
      const { getOrFetchGoogleToken } = await import('../utils/authService');
      const token = await getOrFetchGoogleToken();

      if (!token) {
        console.warn('[AppContext] No Google token available, cannot fetch storage.');
        setStorageInfo(null);
        setIsLoadingStorage(false);
        return;
      }

      const response = await gapi.client.request({
        path: 'https://www.googleapis.com/drive/v3/about',
        params: { fields: 'storageQuota' },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.result.storageQuota) {
        const { storageQuota } = response.result;
        const data = {
          used: parseInt(storageQuota.usage || '0', 10),
          total: parseInt(storageQuota.limit || '0', 10),
        };
        setStorageInfo(data);
        setCachedData(CACHE_KEYS.STORAGE, data);
      } else {
        setStorageInfo(null);
      }
    } catch (error) {
      console.error('[AppContext] Error loading storage info:', error);
      // Keep cached value if API fails
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCredits(), refreshStorage()]);
  }, [refreshCredits, refreshStorage]);

  const setUserInfo = useCallback((email: string, name?: string, image?: string) => {
    setUserEmail(email);
    setUserName(name || email.split('@')[0]);
    setUserImage(image || '');
  }, []);

  // Auto-refresh when userEmail is set
  useEffect(() => {
    if (userEmail) {
      refreshAll();
    }
  }, [userEmail, refreshAll]);

  return (
    <AppContext.Provider
      value={{
        userEmail,
        userName,
        userImage,
        creditBalance,
        storageInfo,
        isLoadingStorage,
        isLoadingCredits,
        hasDecryptionError,
        setDecryptionError,
        refreshCredits,
        refreshStorage,
        refreshAll,
        setUserInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
