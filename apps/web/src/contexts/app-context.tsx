import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { gapi } from "gapi-script";
import { AUTH_SESSION_CLEARED_EVENT } from "../utils/authEvents";

// Cache configuration
const CACHE_KEYS = {
  STORAGE: "zerodrive-storage-cache",
  USER_INFO: "zerodrive-user-info-cache",
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const USER_INFO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
    );
  } catch (error) {
    console.warn("Failed to cache data:", error);
  }
};

interface AppContextType {
  userEmail: string;
  userName: string;
  userImage: string;
  storageInfo: { used: number; total: number } | null;
  isLoadingStorage: boolean;
  hasDecryptionError: boolean;
  setDecryptionError: (hasError: boolean) => void;
  refreshStorage: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setUserInfo: (email: string, name?: string, image?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface UserInfoState {
  email: string;
  name: string;
  image: string;
}

interface CachedUserInfo extends UserInfoState {
  version: 1;
  timestamp: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fallbackNameForEmail(email: string): string {
  return email.split("@")[0] || email;
}

function readSessionGoogleTokenEmail(): string {
  try {
    const storedData = sessionStorage.getItem("google-tokens");
    if (!storedData) return "";

    const parsed = JSON.parse(storedData) as { userEmail?: string };
    return parsed.userEmail || "";
  } catch {
    return "";
  }
}

function readCachedUserInfo(): UserInfoState {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.USER_INFO);
    if (!cached) return { email: "", name: "", image: "" };

    const parsed = JSON.parse(cached) as CachedUserInfo;
    if (parsed.version !== 1) return { email: "", name: "", image: "" };
    if (Date.now() - parsed.timestamp > USER_INFO_CACHE_TTL) {
      localStorage.removeItem(CACHE_KEYS.USER_INFO);
      return { email: "", name: "", image: "" };
    }
    const sessionEmail = readSessionGoogleTokenEmail();
    if (
      normalizeEmail(sessionEmail) &&
      normalizeEmail(parsed.email) !== normalizeEmail(sessionEmail)
    ) {
      return { email: "", name: "", image: "" };
    }

    return {
      email: parsed.email || "",
      name: parsed.name || "",
      image: parsed.image || "",
    };
  } catch {
    return { email: "", name: "", image: "" };
  }
}

function writeCachedUserInfo(userInfo: UserInfoState): void {
  try {
    if (!userInfo.email) {
      localStorage.removeItem(CACHE_KEYS.USER_INFO);
      return;
    }

    const cached: CachedUserInfo = {
      version: 1,
      timestamp: Date.now(),
      ...userInfo,
    };
    localStorage.setItem(CACHE_KEYS.USER_INFO, JSON.stringify(cached));
  } catch {
    // Best-effort UI cache only.
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userInfo, setUserInfoState] =
    useState<UserInfoState>(readCachedUserInfo);
  const [storageInfo, setStorageInfo] = useState<{
    used: number;
    total: number;
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [hasDecryptionError, setHasDecryptionError] = useState(false);

  const setDecryptionError = useCallback((hasError: boolean) => {
    setHasDecryptionError(hasError);
  }, []);

  const refreshStorage = useCallback(async () => {
    // Load from cache immediately
    const cached = getCachedData<{ used: number; total: number }>(
      CACHE_KEYS.STORAGE,
    );
    if (cached) {
      setStorageInfo(cached);
    }

    setIsLoadingStorage(true);
    try {
      const { getOrFetchGoogleToken } = await import("../utils/authService");
      const token = await getOrFetchGoogleToken();

      if (!token) {
        console.warn(
          "[AppContext] No Google token available, cannot fetch storage.",
        );
        setStorageInfo(null);
        setIsLoadingStorage(false);
        return;
      }

      const response = await gapi.client.request({
        path: "https://www.googleapis.com/drive/v3/about",
        params: { fields: "storageQuota" },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.result.storageQuota) {
        const { storageQuota } = response.result;
        const data = {
          used: parseInt(storageQuota.usage || "0", 10),
          total: parseInt(storageQuota.limit || "0", 10),
        };
        setStorageInfo(data);
        setCachedData(CACHE_KEYS.STORAGE, data);
      } else {
        setStorageInfo(null);
      }
    } catch (error) {
      console.error("[AppContext] Error loading storage info:", error);
      // Keep cached value if API fails
    } finally {
      setIsLoadingStorage(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await refreshStorage();
  }, [refreshStorage]);

  const setUserInfo = useCallback(
    (email: string, name?: string, image?: string) => {
      setUserInfoState((current) => {
        const normalizedCurrentEmail = normalizeEmail(current.email);
        const normalizedNextEmail = normalizeEmail(email);
        const sameUser =
          !!normalizedCurrentEmail &&
          normalizedCurrentEmail === normalizedNextEmail;
        const fallbackName = fallbackNameForEmail(email);
        const nextName =
          name && (!sameUser || name !== fallbackName || !current.name)
            ? name
            : sameUser && current.name
              ? current.name
              : name || fallbackName;
        const nextUserInfo = {
          email,
          name: nextName,
          image:
            image !== undefined
              ? image
              : sameUser && current.image
                ? current.image
                : "",
        };

        if (
          current.email === nextUserInfo.email &&
          current.name === nextUserInfo.name &&
          current.image === nextUserInfo.image
        ) {
          return current;
        }

        writeCachedUserInfo(nextUserInfo);
        return nextUserInfo;
      });
    },
    [],
  );

  // Auto-refresh when userEmail is set
  useEffect(() => {
    if (userInfo.email) {
      refreshAll();
    }
  }, [userInfo.email, refreshAll]);

  useEffect(() => {
    const clearUserState = () => {
      setUserInfoState({ email: "", name: "", image: "" });
      writeCachedUserInfo({ email: "", name: "", image: "" });
      setStorageInfo(null);
      setIsLoadingStorage(false);
      setHasDecryptionError(false);
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearUserState);
    return () =>
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clearUserState);
  }, []);

  return (
    <AppContext.Provider
      value={{
        userEmail: userInfo.email,
        userName: userInfo.name,
        userImage: userInfo.image,
        storageInfo,
        isLoadingStorage,
        hasDecryptionError,
        setDecryptionError,
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
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
