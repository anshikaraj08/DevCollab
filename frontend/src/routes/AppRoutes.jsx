import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PageLoader from "../components/PageLoader";
import UserAuth from "../auth/UserAuth";
import AppLayout from "../components/layout/AppLayout";
import MarketingLayout from "../components/layout/MarketingLayout";
import Home from "../screens/Home";
import Landing from "../screens/Landing";
import Privacy from "../screens/Privacy";
import Terms from "../screens/Terms";
import Login from "../screens/Login";
import Register from "../screens/Register";
import ForgotPassword from "../screens/ForgotPassword";
import ResetPassword from "../screens/ResetPassword";
import VerifyEmail from "../screens/VerifyEmail";
import AuthCallback from "../screens/AuthCallback";
import Invite from "../screens/Invite";
import UnsubscribeDigest from "../screens/UnsubscribeDigest";

// Heavy screens load on demand: Room pulls in Monaco and Yjs.
const Room = lazy(() => import("../screens/Room"));
const Settings = lazy(() => import("../screens/Settings"));

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* public pages that share the marketing navigation and footer */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/unsubscribe-digest" element={<UnsubscribeDigest />} />

        {/* logged-in pages that share the slim app bar */}
        <Route
          element={
            <UserAuth>
              <AppLayout />
            </UserAuth>
          }
        >
          <Route path="/dashboard" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* the room uses the whole screen, so it has its own toolbar */}
        <Route
          path="/room/:roomId"
          element={
            <UserAuth>
              <Room />
            </UserAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
