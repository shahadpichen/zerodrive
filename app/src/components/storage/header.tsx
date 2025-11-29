import React from "react";
import { gapi } from "gapi-script";
import { clearStoredKey } from "../../utils/cryptoUtils";
import {
  clearSession,
  getSessionUser,
  setSessionUser,
} from "../../utils/sessionManager";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Progress } from "../ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Zap, Coins } from "lucide-react";
import { Button } from "../ui/button";
import apiClient from "../../utils/apiClient";
import { hashEmail } from "../../utils/fileSharing";

interface HeaderProps {
  setIsAuthenticated: (value: boolean) => void;
}

function Header({ setIsAuthenticated }: HeaderProps) {
  const [user, setUser] = React.useState<{
    name: string;
    imageUrl: string;
  } | null>(null);
  const [storageInfo, setStorageInfo] = React.useState<{
    used: number;
    total: number;
  } | null>(null);
  const [creditBalance, setCreditBalance] = React.useState<number | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadUserAndStorageInfo = async () => {
    try {
      // Initialize GAPI with backend tokens
      const { initializeGapi } = await import("../../utils/gapiInit");
      const { getUserEmail } = await import("../../utils/authService");

      await initializeGapi();

      // Get user email from JWT
      const currentEmail = await getUserEmail();

      if (!currentEmail) {
        console.log("User not signed in");
        setIsAuthenticated(false);
        window.location.href = "/";
        return;
      }

      // Account switch detection
      const sessionEmail = getSessionUser();

      if (sessionEmail && sessionEmail !== currentEmail) {
        console.warn(
          `Account switch detected: ${sessionEmail} -> ${currentEmail}`
        );
        console.log("Clearing previous session and reinitializing...");

        // Clear old session
        clearSession();

        // Set new user
        setSessionUser(currentEmail);

        // Reload to reinitialize with new account
        window.location.reload();
        return;
      }

      // Store current user if not set
      if (!sessionEmail) {
        setSessionUser(currentEmail);
      }

      // Get GAPI auth instance
      const authInstance = gapi.auth2?.getAuthInstance();
      if (!authInstance) {
        console.error("GAPI auth instance not available");
        return;
      }

      const currentUser = authInstance.currentUser.get();
      const profile = currentUser.getBasicProfile();

      setUser({
        name: profile.getName(),
        imageUrl: profile.getImageUrl(),
      });

      // Get fresh token
      const token = currentUser.getAuthResponse().access_token;

      // Set token for request
      gapi.client.setToken({
        access_token: token,
      });

      // Fetch storage information
      const response = await gapi.client.request({
        path: "https://www.googleapis.com/drive/v3/about",
        params: {
          fields: "storageQuota",
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log(response);

      if (response.result.storageQuota) {
        const { storageQuota } = response.result;
        setStorageInfo({
          used: parseInt(storageQuota.usage || "0"),
          total: parseInt(storageQuota.limit || "0"),
        });
      }

      // Fetch credit balance
      try {
        const hashedEmail = await hashEmail(currentEmail);
        const balanceData = await apiClient.credits.getBalance(hashedEmail);
        setCreditBalance(balanceData.balance);
      } catch (creditError) {
        console.error("Error fetching credit balance:", creditError);
        // Don't fail the whole function if credits fail to load
      }
    } catch (error: any) {
      console.error("Error loading user and storage info:", error);
      if (error.status === 401) {
        setIsAuthenticated(false);
        window.location.href = "/";
      }
    }
  };

  React.useEffect(() => {
    const initAndLoad = async () => {
      try {
        await loadUserAndStorageInfo();
      } catch (error) {
        console.error("Error in initial load:", error);
      }
    };

    initAndLoad();

    const intervalId = setInterval(loadUserAndStorageInfo, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [setIsAuthenticated]);

  const handleLogout = async () => {
    try {
      const { logout } = await import("../../utils/authService");
      const { clearSession } = await import("../../utils/sessionManager");

      // Call auth service logout (clears cookies, localStorage, sessionStorage)
      await logout();
      clearSession();
      setIsAuthenticated(false);

      console.log("Logout complete - redirecting to home");

      // Use replace() to prevent back button issues
      // Longer timeout to ensure cookies are fully cleared before redirect
      setTimeout(() => {
        console.log("[Logout Handler] Redirecting to home page");
        window.location.replace("/");
      }, 500);
    } catch (error) {
      console.error("Error during logout:", error);
      // Redirect anyway on error
      window.location.replace("/");
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage < 60) return "hsl(142.1 76.2% 36.3%)"; // green-500
    if (percentage < 75) return "hsl(47.9 95.8% 53.1%)"; // yellow-500
    return "hsl(0 84.2% 60.2%)"; // red-500
  };

  const usagePercentage = storageInfo
    ? (storageInfo.used / storageInfo.total) * 100
    : 0;

  return (
    <header className="w-full border-b h-[10vh] flex">
      <div className="flex w-full mx-14">
        <div className="mr-4 flex">
          <a className="mr-6 flex items-center space-x-1">
            <img
              src="/logo192.png"
              alt="ZeroDrive Logo"
              className="h-10 w-10"
            />
            <span className="font-bold text-lg sm:inline-block">ZeroDrive</span>
          </a>
        </div>
        <div className="flex flex-1 items-center space-x-4 md:space-x-8 justify-end">
          {creditBalance !== null && (
            <div className="hidden md:flex flex-col items-end gap-1 min-w-[120px]">
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Coins
                    className={
                      creditBalance < 1
                        ? "text-red-600"
                        : creditBalance < 3
                        ? "text-amber-600"
                        : "text-green-600"
                    }
                    size={14}
                  />
                  Credits
                </span>
                <span
                  className={`text-xs font-semibold ${
                    creditBalance < 1
                      ? "text-red-600"
                      : creditBalance < 3
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {creditBalance.toFixed(1)}
                </span>
              </div>
            </div>
          )}
          {storageInfo && (
            <div className="hidden md:flex flex-col items-end gap-2 min-w-[200px]">
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="text-green-600" size={14} />
                  Storage
                </span>
                <span className="text-xs">
                  {formatBytes(storageInfo.used)} /{" "}
                  {formatBytes(storageInfo.total)}
                </span>
              </div>
              <div className="w-full">
                <Progress
                  value={usagePercentage}
                  className="h-1.5"
                  style={{
                    ["--progress-background" as string]:
                      getProgressColor(usagePercentage),
                  }}
                />
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs sm:text-sm px-2 sm:px-3"
          >
            {user?.name ? `Logout (${user.name.split(" ")[0]})` : "Logout"}
          </Button>
        </div>
      </div>
    </header>
  );
}

export default Header;
