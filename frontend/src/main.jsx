import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { loader } from "@monaco-editor/react";
import "./index.css";
import { ThemeProvider } from "./context/theme.context.jsx";
import { UserProvider } from "./context/user.context.jsx";
import ToastProvider from "./components/ui/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

// Self-hosted Monaco assets configuration:
// When VITE_MONACO_BASE is provided (e.g. "/monaco"), load directly from self-hosted static files
if (import.meta.env.VITE_MONACO_BASE) {
  loader.config({
    paths: {
      vs: `${import.meta.env.VITE_MONACO_BASE.replace(/\/+$/, "")}/vs`,
    },
  });
}

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
