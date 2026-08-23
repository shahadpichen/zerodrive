/**
 * OAuth Callback Page
 * Handles OAuth callback from backend
 * - JWT token stored in httpOnly cookie by backend
 * - Google tokens encrypted and stored in sessionStorage by frontend
 */

import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  getGoogleUserProfile,
  getUserEmail,
  storeGoogleTokens,
} from "../utils/authService";
import apiClient from "../utils/apiClient";
import logger from "../utils/logger";
import { queueHomeLoginWelcome } from "../utils/homeWelcome";
import { useApp } from "../contexts/app-context";
import { hasRequiredGoogleDriveScopes } from "../utils/googleDrivePermissions";

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const callbackStarted = useRef(false);
  const { setUserInfo } = useApp();

  useEffect(() => {
    // React Strict Mode intentionally re-runs effects in development. OAuth
    // exchange codes are single-use, so this callback must only start once.
    if (callbackStarted.current) return;
    callbackStarted.current = true;

    const handleCallback = async () => {
      // Check for OAuth error
      const errorParam = searchParams.get("error");

      if (errorParam) {
        // Handle OAuth errors
        let errorMessage = "Authentication failed";

        switch (errorParam) {
          case "access_denied":
            errorMessage =
              "Access denied - You need to grant permissions to use ZeroDrive";
            break;
          case "email_not_verified":
            errorMessage =
              "Email not verified - Please verify your Google account email";
            break;
          case "no_code":
            errorMessage = "No authorization code received";
            break;
          case "auth_failed":
            errorMessage = "Authentication failed - Please try again";
            break;
          case "oauth_init_failed":
            errorMessage = "Failed to initialize OAuth - Please try again";
            break;
          default:
            errorMessage = `Authentication error: ${errorParam}`;
        }

        setError(errorMessage);
        toast.error("Sign-in failed", {
          description: errorMessage,
        });

        // Redirect to landing page after 3 seconds
        setTimeout(() => {
          navigate("/");
        }, 3000);
        return;
      }

      try {
        // JWT token is already set as httpOnly cookie by backend

        const exchangeCode = searchParams.get("exchange");

        if (exchangeCode) {
          const response = await apiClient.post("/auth/exchange", {
            code: exchangeCode,
          });
          const tokenData = response.data as {
            accessToken: string;
            refreshToken?: string;
            expiresAt: string;
            scope: string;
            isNewUser: boolean;
            hasLimitedScope: boolean;
          };

          // Get user email (from JWT cookie)
          const userEmail = await getUserEmail();

          if (!userEmail) {
            throw new Error("Failed to get user email");
          }

          // Encrypt and store Google tokens in sessionStorage
          await storeGoogleTokens(
            {
              accessToken: tokenData.accessToken,
              expiresAt: new Date(tokenData.expiresAt),
              scope: tokenData.scope,
            },
            userEmail,
          );

          logger.log(
            "[OAuth] Google tokens successfully stored in sessionStorage",
          );

          // Verify tokens were stored
          const storedData = sessionStorage.getItem("google-tokens");
          logger.log(
            "[OAuth] Verification - tokens exist in sessionStorage:",
            !!storedData,
          );

          const profile = await getGoogleUserProfile(tokenData.accessToken);
          if (
            profile &&
            profile.email.trim().toLowerCase() === userEmail.trim().toLowerCase()
          ) {
            setUserInfo(userEmail, profile.name, profile.picture);
          } else {
            setUserInfo(userEmail, userEmail.split("@")[0]);
          }

          queueHomeLoginWelcome();

          const isNewUser = tokenData.isNewUser;
          const hasLimitedScope = tokenData.hasLimitedScope;

          if (hasLimitedScope) {
            toast.warning("Google Drive permission is incomplete", {
              description:
                hasRequiredGoogleDriveScopes(tokenData.scope)
                  ? "Google reported limited access, but the required Drive permissions are present."
                  : "Storage and sharing stay locked until Drive access is granted.",
            });
          } else if (isNewUser) {
            toast.success("Welcome to ZeroDrive!", {
              description: "Your account has been created successfully",
            });
          } else {
            toast.success("Signed in successfully!");
          }
        } else {
          throw new Error("OAuth exchange code is missing");
        }

        // Navigate to the home hub - ProtectedRoute will verify auth via cookie
        navigate("/home");
      } catch (error) {
        logger.error("Failed to complete sign-in:", error);
        setError("Failed to complete sign-in");
        toast.error("Sign-in failed", {
          description:
            error instanceof Error
              ? error.message
              : "Failed to complete authentication process",
        });

        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUserInfo]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <div className="text-red-500 text-4xl">✕</div>
            <h2 className="text-xl font-semibold text-foreground">
              Sign-in Failed
            </h2>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <p className="text-sm text-muted-foreground">
              Redirecting to home...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              Completing sign-in...
            </h2>
            <p className="text-muted-foreground">
              Please wait while we set up your session
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
