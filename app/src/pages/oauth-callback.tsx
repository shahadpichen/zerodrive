/**
 * OAuth Callback Page
 * Handles OAuth callback from backend and stores JWT token
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../utils/authService';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Get token from query params
      const token = searchParams.get('token');
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

      if (!token) {
        setError('No authentication token received');
        toast.error('Sign-in failed', {
          description: 'No token received from server',
        });

        setTimeout(() => {
          navigate('/');
        }, 3000);
        return;
      }

      try {
        // Store token
        setToken(token);

        // Store authentication status
        sessionStorage.setItem('isAuthenticated', 'true');

        // Show success message
        toast.success('Signed in successfully!');

        // Navigate to storage - ProtectedRoute will check auth fresh
        navigate('/storage');
      } catch (error) {
        console.error('Failed to store token:', error);
        setError('Failed to complete sign-in');
        toast.error('Sign-in failed', {
          description: 'Failed to store authentication token',
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
