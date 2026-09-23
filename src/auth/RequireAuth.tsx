import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AUTH_BYPASS } from "./authConfig";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function RequireAuth({ allowedRoles }: { allowedRoles?: string[] }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (AUTH_BYPASS) return <Outlet />;

  if (loading) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && user && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "PARENT" ? "/parent-portal" : user.role === "STUDENT" ? "/student-portal" : user.role === "TEACHER" ? "/teacher-portal" : "/"}
        replace
      />
    );
  }

  return <Outlet />;
}
