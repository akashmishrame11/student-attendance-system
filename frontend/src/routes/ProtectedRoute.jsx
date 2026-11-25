import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, HOME_BY_ROLE } from "../context/AuthContext";
import { Spinner } from "../components/ui";

export function FullScreenLoader() {
  return (
    <div className="app-root flex min-h-screen items-center justify-center bg-slate-50">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/** Requires login; optionally restricts to roles. Wrong role → their own dashboard. */
export function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return <Outlet />;
}

/** For login/forgot pages: logged-in users go straight to their dashboard. */
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return <Outlet />;
}
