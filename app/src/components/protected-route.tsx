import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated as checkAuth } from "../utils/authService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectPath = "/",
}) => {
  // Check authentication fresh every time this route renders
  const isAuthenticated = checkAuth();

  if (!isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
