import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { loader } from "@monaco-editor/react";
import "./index.css";
import { ThemeProvider } from "./context/theme.context.jsx";
import { UserProvider } from "./context/user.context.jsx";
import ToastProvider from "./components/ui/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

// Initialize Sentry on frontend if DSN configured
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE || "development",
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      return event;
    },
  });
}

// Self-hosted Monaco assets configuration.
// `npm run build` copies Monaco into public/monaco, and the production CSP only
// allows same-origin scripts, so production builds default to "/monaco".
// In development an empty value falls back to the CDN.
const monacoBase = import.meta.env.VITE_MONACO_BASE || (import.meta.env.PROD ? "/monaco" : "");
if (monacoBase) {
  loader.config({
    paths: {
      vs: `${monacoBase.replace(/\/+$/, "")}/vs`,
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
