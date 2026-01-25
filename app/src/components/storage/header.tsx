import React from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "../ui/progress";
import { Zap, Coins, Menu, LogOut, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { useApp } from "../../contexts/app-context";
import { useSidebar } from "../../contexts/sidebar-context";
import { ModeToggle } from "../mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

function Header() {
  const navigate = useNavigate();
  const {
    creditBalance,
    storageInfo,
    isLoadingCredits,
    isLoadingStorage,
    userEmail,
    userName,
    userImage,
    hasDecryptionError,
  } = useApp();
  const { toggle } = useSidebar();

  const getUserInitials = (name: string, email: string) => {
    // If name has multiple words, take first letter of each word
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    // For single word, just take first letter
    return name.charAt(0).toUpperCase();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleLogout = async () => {
    try {
      // Clear cache on logout
      localStorage.removeItem("zerodrive-credits-cache");
      localStorage.removeItem("zerodrive-storage-cache");

      const { logout } = await import("../../utils/authService");
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
      navigate("/");
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
    <header className="w-full border-b h-[8vh] flex">
      <div className="flex w-full mx-4 md:mx-14 items-center justify-between">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-2"
            onClick={toggle}
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center space-x-1">
            <img
              src="/logo192.png"
              alt="ZeroDrive Logo"
              className="h-10 w-10"
            />
            <span className="font-bold text-lg sm:inline-block">ZeroDrive</span>
          </div>
        </div>

        {/* Right: Mode Toggle + User Dropdown */}
        <div className="flex items-center space-x-4">
          {hasDecryptionError && (
            <div className="hidden md:flex items-center gap-2 bg-accent px-4 py-2 rounded-md border-2 border-accent-border">
              <AlertTriangle className="h-4 w-4 text-accent-foreground" />
              <span className="text-xs font-medium text-accent-foreground">
                Decryption failed -
                <button
                  onClick={() => navigate("/key-management")}
                  className="ml-1 underline hover:no-underline"
                >
                  Update encryption key
                </button>
              </span>
            </div>
          )}

          <ModeToggle />

          {userEmail && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-0"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={userImage} alt={userName} />
                    <AvatarFallback>
                      {getUserInitials(userName, userEmail)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {userName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Credits Section */}
                <div className="px-2 py-3">
                  {userEmail && creditBalance === null ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Credits
                      </span>
                      <div className="h-4 bg-muted animate-pulse rounded w-16"></div>
                    </div>
                  ) : (
                    creditBalance !== null && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Coins
                            className={
                              creditBalance < 1
                                ? "text-red-600"
                                : creditBalance < 3
                                  ? "text-amber-600"
                                  : "text-green-600"
                            }
                            size={16}
                          />
                          Credits
                        </span>
                        <span
                          className={`text-sm font-semibold ${
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
                    )
                  )}
                </div>

                <DropdownMenuSeparator />

                {/* Storage Section */}
                <div className="px-2 py-3">
                  {userEmail && !storageInfo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Storage
                        </span>
                        <div className="h-4 bg-muted animate-pulse rounded w-24"></div>
                      </div>
                      <div className="h-2 bg-muted animate-pulse rounded w-full"></div>
                    </div>
                  ) : (
                    storageInfo && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Zap className="text-green-600" size={16} />
                            Storage
                          </span>
                          <span className="text-xs">
                            {formatBytes(storageInfo.used)} /{" "}
                            {formatBytes(storageInfo.total)}
                          </span>
                        </div>
                        <Progress
                          value={usagePercentage}
                          className="h-2"
                          style={{
                            ["--progress-background" as string]:
                              getProgressColor(usagePercentage),
                          }}
                        />
                      </div>
                    )
                  )}
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
