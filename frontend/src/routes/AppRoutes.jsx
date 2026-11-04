import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import UserAuth from "../auth/UserAuth";
import AppLayout from "../components/layout/AppLayout";
import MarketingLayout from "../components/layout/MarketingLayout";
import Home from "../screens/Home";
import Landing from "../screens/Landing";
import Login from "../screens/Login";
import Register from "../screens/Register";
import Room from "../screens/Room";
import Invite from "../screens/Invite";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public pages that share the marketing navigation and footer */}
        <Route element={<MarketingLayout />}>
          <Route path="/" element={<Landing />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite/:token" element={<Invite />} />

        {/* logged-in pages that share the slim app bar */}
        <Route element={<UserAuth><AppLayout /></UserAuth>}>
          <Route path="/dashboard" element={<Home />} />
        </Route>

        {/* the room uses the whole screen, so it has its own toolbar */}
        <Route path="/room/:roomId" element={<UserAuth><Room /></UserAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
