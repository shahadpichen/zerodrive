import React from "react";
import { gapi } from "gapi-script";
import { clearStoredKey } from "../../utils/cryptoUtils";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Progress } from "../ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { BsFillLightningChargeFill } from "react-icons/bs";

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 768;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const loadUserAndStorageInfo = async () => {
    try {
      // Wait for GAPI to initialize
      await new Promise((resolve) => {
        gapi.load("client:auth2", resolve);
      });

      // Initialize GAPI
      await gapi.client.init({
        clientId: process.env.REACT_APP_PUBLIC_CLIENT_ID,
        scope: process.env.REACT_APP_PUBLIC_SCOPE,
      });

      const authInstance = gapi.auth2.getAuthInstance();

      if (!authInstance || !authInstance.isSignedIn.get()) {
        console.log("User not signed in");
        setIsAuthenticated(false);
        window.location.href = "/";
        return;
      }

      const currentUser = authInstance.currentUser.get();
      const profile = currentUser.getBasicProfile();

      if (!profile) {
        console.error("No profile found");
        return;
      }

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

      if (response.result.storageQuota) {
        const { storageQuota } = response.result;
        setStorageInfo({
          used: parseInt(storageQuota.usage || "0"),
          total: parseInt(storageQuota.limit || "0"),
        });
      }
    } catch (error) {
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
      const authInstance = gapi.auth2.getAuthInstance();
      if (authInstance) {
        await authInstance.signOut();
        setIsAuthenticated(false);
        clearStoredKey();
        localStorage.removeItem("isAuthenticated");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Error during logout:", error);
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
        <div className="flex flex-1 items-center space-x-14 justify-end">
          {storageInfo && (
            <div className="hidden md:flex flex-col items-end gap-3 min-w-[250px]">
              <div className="flex justify-between items-center w-full">
                <span className="flex items-center gap-1 text-sm">
                  <BsFillLightningChargeFill className="text-green-600" />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-10 w-10 cursor-pointer">
                <AvatarImage src={user?.imageUrl} alt={user?.name} />
                <AvatarFallback>
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>{user?.name}</DropdownMenuItem>

              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default Header;
