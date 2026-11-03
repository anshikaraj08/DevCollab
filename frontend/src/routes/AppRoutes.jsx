import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserAuth from "../auth/UserAuth";
import Landing from "../screens/Landing";
import Login from "../screens/Login";
import Register from "../screens/Register";
import Home from "../screens/Home";
import Room from "../screens/Room";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <UserAuth>
              <Home />
            </UserAuth>
          }
        />
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
    </BrowserRouter>
  );
}
