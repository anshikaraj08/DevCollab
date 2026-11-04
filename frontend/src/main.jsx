import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ThemeProvider } from "./context/theme.context.jsx";
import { UserProvider } from "./context/user.context.jsx";
import ToastProvider from "./components/ui/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <UserProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
