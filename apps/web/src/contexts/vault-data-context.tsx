import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import { useApp } from "./app-context";
import {
  FileMeta,
  FolderMeta,
  getAllFilesForUser,
  getFoldersForUser,
} from "../utils/dexieDB";
import { RECOVERY_PHRASE_MEMORY_EVENT } from "../utils/mnemonicManager";
import { VAULT_KEY_STORAGE_EVENT } from "../utils/cryptoUtils";
import { hasVaultReadAccess } from "../utils/vaultAccess";
import {
  clearRememberedVaultMetadataStatuses,
  rememberVaultMetadataStatus,
} from "../utils/vaultMetadataWriteGuard";

export type VaultMetadataStatus =
  "unverified" | "verifying" | "ready" | "decryption_error" | "error";

interface VaultDataState {
  userEmail: string;
  files: FileMeta[];
  folders: FolderMeta[];
  isHydrating: boolean;
  isRefreshing: boolean;
  metadataStatus: VaultMetadataStatus;
  hasVaultKey: boolean | null;
  lastSyncedAt: number | null;
  error: string | null;
}

type VaultDataAction =
  | { type: "reset" }
  | { type: "hydrate_start"; userEmail: string }
  | {
      type: "replace";
      userEmail: string;
      files: FileMeta[];
      folders: FolderMeta[];
      metadataStatus?: VaultMetadataStatus;
    }
  | {
      type: "metadata_status";
      userEmail: string;
      metadataStatus: VaultMetadataStatus;
      error?: string | null;
    }
  | { type: "refresh_start"; userEmail: string }
  | { type: "key_status"; userEmail: string; hasVaultKey: boolean }
  | { type: "refresh_error"; userEmail: string; error: string };

const initialVaultDataState: VaultDataState = {
  userEmail: "",
  files: [],
  folders: [],
  isHydrating: false,
  isRefreshing: false,
  metadataStatus: "unverified",
  hasVaultKey: null,
  lastSyncedAt: null,
  error: null,
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isSameAccount(state: VaultDataState, userEmail: string): boolean {
  return state.userEmail === normalizeEmail(userEmail);
}

function vaultDataReducer(
  state: VaultDataState,
  action: VaultDataAction,
): VaultDataState {
  switch (action.type) {
    case "reset":
      return initialVaultDataState;
    case "hydrate_start":
      return {
        ...initialVaultDataState,
        userEmail: normalizeEmail(action.userEmail),
        isHydrating: true,
      };
    case "replace": {
      const userEmail = normalizeEmail(action.userEmail);
      const sameAccount = state.userEmail === userEmail;
      return {
        ...state,
        userEmail,
        files: action.files,
        folders: action.folders,
        isHydrating: false,
        isRefreshing: false,
        metadataStatus:
          action.metadataStatus ??
          (sameAccount ? state.metadataStatus : "unverified"),
        lastSyncedAt: Date.now(),
        error: null,
      };
    }
    case "metadata_status":
      if (!isSameAccount(state, action.userEmail)) return state;
      return {
        ...state,
        metadataStatus: action.metadataStatus,
        isRefreshing: action.metadataStatus === "verifying",
        error: action.error ?? null,
      };
    case "refresh_start":
      if (!isSameAccount(state, action.userEmail)) return state;
      return { ...state, isRefreshing: true, error: null };
    case "key_status":
      if (!isSameAccount(state, action.userEmail)) return state;
      return { ...state, hasVaultKey: action.hasVaultKey };
    case "refresh_error":
      if (!isSameAccount(state, action.userEmail)) return state;
      return {
        ...state,
        isHydrating: false,
        isRefreshing: false,
        metadataStatus:
          state.metadataStatus === "verifying" ? "error" : state.metadataStatus,
        error: action.error,
      };
    default:
      return state;
  }
}

interface ReplaceVaultDataOptions {
  metadataStatus?: VaultMetadataStatus;
}

interface VaultDataContextValue {
  state: VaultDataState;
  replaceVaultData: (
    userEmail: string,
    files: FileMeta[],
    folders: FolderMeta[],
    options?: ReplaceVaultDataOptions,
  ) => void;
  refreshVaultFromLocal: (
    userEmail: string,
    options?: ReplaceVaultDataOptions,
  ) => Promise<{ files: FileMeta[]; folders: FolderMeta[] }>;
  setVaultMetadataStatus: (
    userEmail: string,
    status: VaultMetadataStatus,
    error?: string | null,
  ) => void;
  setVaultKeyStatus: (userEmail: string, hasVaultKey: boolean) => void;
  clearVaultData: () => void;
}

const VaultDataContext = createContext<VaultDataContextValue | null>(null);

export function VaultDataProvider({ children }: { children: React.ReactNode }) {
  const { userEmail } = useApp();
  const [state, dispatch] = useReducer(vaultDataReducer, initialVaultDataState);

  const replaceVaultData = useCallback(
    (
      email: string,
      files: FileMeta[],
      folders: FolderMeta[],
      options: ReplaceVaultDataOptions = {},
    ) => {
      if (options.metadataStatus) {
        rememberVaultMetadataStatus(email, options.metadataStatus);
      }
      dispatch({
        type: "replace",
        userEmail: email,
        files,
        folders,
        metadataStatus: options.metadataStatus,
      });
    },
    [],
  );

  const refreshVaultFromLocal = useCallback(
    async (
      email: string,
      options: ReplaceVaultDataOptions = {},
    ): Promise<{ files: FileMeta[]; folders: FolderMeta[] }> => {
      dispatch({ type: "refresh_start", userEmail: email });
      try {
        const [files, folders] = await Promise.all([
          getAllFilesForUser(email),
          getFoldersForUser(email),
        ]);
        replaceVaultData(email, files, folders, options);
        return { files, folders };
      } catch (error) {
        dispatch({
          type: "refresh_error",
          userEmail: email,
          error:
            error instanceof Error ? error.message : "Could not load vault",
        });
        rememberVaultMetadataStatus(email, "error");
        throw error;
      }
    },
    [replaceVaultData],
  );

  const setVaultMetadataStatus = useCallback(
    (
      email: string,
      status: VaultMetadataStatus,
      error: string | null = null,
    ) => {
      rememberVaultMetadataStatus(email, status);
      dispatch({
        type: "metadata_status",
        userEmail: email,
        metadataStatus: status,
        error,
      });
    },
    [],
  );

  const setVaultKeyStatus = useCallback(
    (email: string, hasVaultKey: boolean) => {
      dispatch({
        type: "key_status",
        userEmail: email,
        hasVaultKey,
      });
    },
    [],
  );

  const clearVaultData = useCallback(() => {
    clearRememberedVaultMetadataStatuses();
    dispatch({ type: "reset" });
  }, []);

  useEffect(() => {
    const email = normalizeEmail(userEmail);
    if (!email) {
      clearVaultData();
      return;
    }

    let isMounted = true;
    dispatch({ type: "hydrate_start", userEmail: email });

    Promise.all([
      getAllFilesForUser(email),
      getFoldersForUser(email),
      hasVaultReadAccess(),
    ])
      .then(([files, folders, hasAccess]) => {
        if (!isMounted) return;
        replaceVaultData(email, files, folders);
        setVaultKeyStatus(email, hasAccess);
      })
      .catch((error) => {
        if (!isMounted) return;
        rememberVaultMetadataStatus(email, "error");
        dispatch({
          type: "refresh_error",
          userEmail: email,
          error:
            error instanceof Error ? error.message : "Could not load vault",
        });
      });

    return () => {
      isMounted = false;
    };
  }, [clearVaultData, replaceVaultData, setVaultKeyStatus, userEmail]);

  useEffect(() => {
    const email = normalizeEmail(userEmail);
    if (!email) return;

    const refreshKeyStatus = () => {
      void hasVaultReadAccess().then((hasAccess) => {
        setVaultKeyStatus(email, hasAccess);
      });
    };

    window.addEventListener(RECOVERY_PHRASE_MEMORY_EVENT, refreshKeyStatus);
    window.addEventListener(VAULT_KEY_STORAGE_EVENT, refreshKeyStatus);
    return () => {
      window.removeEventListener(
        RECOVERY_PHRASE_MEMORY_EVENT,
        refreshKeyStatus,
      );
      window.removeEventListener(VAULT_KEY_STORAGE_EVENT, refreshKeyStatus);
    };
  }, [setVaultKeyStatus, userEmail]);

  const exposedState = useMemo<VaultDataState>(() => {
    const activeEmail = normalizeEmail(userEmail);
    if (state.userEmail === activeEmail) return state;

    // Never expose the previous account's file names during the render before
    // the account-change hydration effect runs.
    return {
      ...initialVaultDataState,
      userEmail: activeEmail,
      isHydrating: !!activeEmail,
    };
  }, [state, userEmail]);

  const value = useMemo<VaultDataContextValue>(
    () => ({
      state: exposedState,
      replaceVaultData,
      refreshVaultFromLocal,
      setVaultMetadataStatus,
      setVaultKeyStatus,
      clearVaultData,
    }),
    [
      clearVaultData,
      refreshVaultFromLocal,
      replaceVaultData,
      setVaultKeyStatus,
      setVaultMetadataStatus,
      exposedState,
    ],
  );

  return (
    <VaultDataContext.Provider value={value}>
      {children}
    </VaultDataContext.Provider>
  );
}

export function useVaultData(): VaultDataContextValue {
  const context = useContext(VaultDataContext);
  if (!context) {
    throw new Error("useVaultData must be used within a VaultDataProvider");
  }
  return context;
}

export function useOptionalVaultData(): VaultDataContextValue | null {
  return useContext(VaultDataContext);
}
