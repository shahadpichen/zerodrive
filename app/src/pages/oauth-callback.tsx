/**
 * OAuth Callback Page
 * Handles OAuth callback from backend
 * - JWT token stored in httpOnly cookie by backend
 * - Google tokens encrypted and stored in sessionStorage by frontend
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { storeGoogleTokens } from '../utils/authService';
import { getUserEmail } from '../utils/authService';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for OAuth error
      const errorParam = searchParams.get('error');

      if (errorParam) {
        // Handle OAuth errors
        let errorMessage = 'Authentication failed';

        switch (errorParam) {
          case 'access_denied':
            errorMessage = 'Access denied - You need to grant permissions to use ZeroDrive';
            break;
          case 'email_not_verified':
            errorMessage = 'Email not verified - Please verify your Google account email';
            break;
          case 'no_code':
            errorMessage = 'No authorization code received';
            break;
          case 'auth_failed':
            errorMessage = 'Authentication failed - Please try again';
            break;
          case 'oauth_init_failed':
            errorMessage = 'Failed to initialize OAuth - Please try again';
            break;
          default:
            errorMessage = `Authentication error: ${errorParam}`;
        }

        setError(errorMessage);
        toast.error('Sign-in failed', {
          description: errorMessage,
        });

        // Redirect to landing page after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
        return;
      }

      try {
        // JWT token is already set as httpOnly cookie by backend

        // Get Google tokens from URL (base64-encoded by backend)
        const encodedTokens = searchParams.get('tokens');

        if (encodedTokens) {
          console.log('[OAuth] Received tokens from backend, decoding...');

          // Decode tokens
          const tokenData = JSON.parse(atob(encodedTokens));
          console.log('[OAuth] Token data decoded:', {
            hasAccessToken: !!tokenData.accessToken,
            hasRefreshToken: !!tokenData.refreshToken,
            expiresAt: tokenData.expiresAt,
            scope: tokenData.scope,
          });

          // Get user email (from JWT cookie)
          const userEmail = await getUserEmail();

          if (!userEmail) {
            throw new Error('Failed to get user email');
          }

          console.log('[OAuth] Storing Google tokens for user:', userEmail);

          // Encrypt and store Google tokens in sessionStorage
          await storeGoogleTokens({
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: new Date(tokenData.expiresAt),
            scope: tokenData.scope,
          }, userEmail);

          console.log('[OAuth] Google tokens successfully stored in sessionStorage');

          // Verify tokens were stored
          const storedData = sessionStorage.getItem('google-tokens');
          console.log('[OAuth] Verification - tokens exist in sessionStorage:', !!storedData);
        } else {
          console.warn('[OAuth] No tokens parameter in callback URL - this should not happen');
        }

        // Check for special flags
        const isNewUser = searchParams.get('new') === 'true';
        const hasLimitedScope = searchParams.get('limited') === 'true';

        // Show appropriate message
        if (hasLimitedScope) {
          toast.warning('Limited permissions granted', {
            description: 'Some features may not work without full Google Drive access',
          });
        } else if (isNewUser) {
          toast.success('Welcome to ZeroDrive!', {
            description: 'Your account has been created successfully',
          });
        } else {
          toast.success('Signed in successfully!');
        }

        // Navigate to storage - ProtectedRoute will verify auth via cookie
        navigate('/storage');
      } catch (error) {
        console.error('Failed to complete sign-in:', error);
        setError('Failed to complete sign-in');
        toast.error('Sign-in failed', {
          description: error instanceof Error ? error.message : 'Failed to complete authentication process',
        });

        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <div className="text-red-500 text-4xl">✕</div>
            <h2 className="text-xl font-semibold text-foreground">Sign-in Failed</h2>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to home...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Completing sign-in...</h2>
            <p className="text-muted-foreground">Please wait while we set up your session</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
