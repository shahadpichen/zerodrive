import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated as checkAuth } from "../utils/authService";
import { useRsaKeyRecovery } from "../hooks/useRsaKeyRecovery";

interface ProtectedRouteProps {
  children?: React.ReactNode;
  redirectPath?: string;
}

function AuthenticatedRouteEffects() {
  // This must never mount on public routes. The recovery check talks to the
  // authenticated API and would otherwise turn an expired public session into
  // a redirect/reload loop.
  useRsaKeyRecovery();
  return null;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectPath = "/",
}) => {
  const location = useLocation();
  const previousLocationKeyRef = React.useRef(location.key);
  const navigationGenerationRef = React.useRef(0);

  if (previousLocationKeyRef.current !== location.key) {
    previousLocationKeyRef.current = location.key;
    navigationGenerationRef.current += 1;
  }

  const navigationGeneration = navigationGenerationRef.current;
  const [authResult, setAuthResult] = React.useState<{
    navigationGeneration: number;
    isAuthenticated: boolean;
  } | null>(null);

  React.useEffect(() => {
    let isCurrentCheck = true;

    checkAuth()
      .then((isAuthenticated) => {
        if (isCurrentCheck) {
          setAuthResult({ navigationGeneration, isAuthenticated });
        }
      })
      .catch(() => {
        if (isCurrentCheck) {
          setAuthResult({ navigationGeneration, isAuthenticated: false });
        }
      });

    return () => {
      isCurrentCheck = false;
    };
  }, [location.key, navigationGeneration]);

  const hasVerifiedCurrentLocation =
    authResult?.navigationGeneration === navigationGeneration;

  if (!hasVerifiedCurrentLocation) {
    // Keep account-bound effects mounted while a protected navigation is
    // revalidated, but do not reveal the destination until auth succeeds.
    return authResult?.isAuthenticated ? <AuthenticatedRouteEffects /> : null;
  }

  if (!authResult) {
    return null;
  }

  if (!authResult.isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <>
      <AuthenticatedRouteEffects />
      {children ?? <Outlet />}
    </>
  );
};

export default ProtectedRoute;
