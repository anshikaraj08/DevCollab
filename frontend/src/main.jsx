import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ThemeProvider } from "./context/theme.context.jsx";
import { UserProvider } from "./context/user.context.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </ThemeProvider>
  </StrictMode>
);
