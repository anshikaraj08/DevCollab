import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Login from "../screens/Login";
import Register from "../screens/Register";
import ForgotPassword from "../screens/ForgotPassword";
import ResetPassword from "../screens/ResetPassword";
import VerifyEmail from "../screens/VerifyEmail";
import Settings from "../screens/Settings";
import AppLayout from "../components/layout/AppLayout";
import { UserContext } from "../context/user.context";
import { ThemeProvider } from "../context/theme.context";
import { ToastProvider } from "../components/ui/Toast";
import api from "../config/axios";

vi.mock("../config/axios");

const renderWithProviders = (ui, { user = null, setUser = vi.fn() } = {}, initialEntry = "/") => {
  return render(
    <ThemeProvider>
      <UserContext.Provider value={{ user, setUser, loading: false }}>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
        </ToastProvider>
      </UserContext.Provider>
    </ThemeProvider>
  );
};

describe("Stage 2: Frontend Auth, OAuth & Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe("Login & Register OAuth Buttons", () => {
    it("renders Google and GitHub OAuth buttons on Login", () => {
      renderWithProviders(<Login />);
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
      expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /forgot password\?/i })).toBeInTheDocument();
    });

    it("renders Google and GitHub OAuth buttons on Register", () => {
      renderWithProviders(<Register />);
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
      expect(screen.getByText(/or continue with email/i)).toBeInTheDocument();
    });
  });

  describe("Forgot Password Screen", () => {
    it("renders input, handles submission and displays confirmation", async () => {
      api.post.mockResolvedValueOnce({ data: { message: "Dispatched" } });

      renderWithProviders(<ForgotPassword />);
      const emailInput = screen.getByPlaceholderText(/your email address/i);
      const submitBtn = screen.getByRole("button", { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/users/forgot-password", {
          email: "test@example.com",
        });
      });

      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument();
    });
  });

  describe("Reset Password Screen", () => {
    it("renders password inputs and submits valid reset token", async () => {
      api.post.mockResolvedValueOnce({ data: { message: "Password reset successful" } });

      renderWithProviders(
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>,
        {},
        "/reset-password/sample-reset-token-123"
      );

      const passInputs = screen.getAllByPlaceholderText(/password/i);
      fireEvent.change(passInputs[0], { target: { value: "NewPassword123!" } });
      fireEvent.change(passInputs[1], { target: { value: "NewPassword123!" } });

      const submitBtn = screen.getByRole("button", { name: /reset password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/users/reset-password", {
          token: "sample-reset-token-123",
          password: "NewPassword123!",
        });
      });
    });

    it("rejects non-matching passwords with client-side validation", async () => {
      renderWithProviders(
        <Routes>
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Routes>,
        {},
        "/reset-password/sample-reset-token-123"
      );

      const passInputs = screen.getAllByPlaceholderText(/password/i);
      fireEvent.change(passInputs[0], { target: { value: "NewPassword123!" } });
      fireEvent.change(passInputs[1], { target: { value: "MismatchedPassword123!" } });

      const submitBtn = screen.getByRole("button", { name: /reset password/i });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  describe("Verify Email Screen", () => {
    it("auto-calls verify-email endpoint on mount and displays success", async () => {
      api.post.mockResolvedValueOnce({ data: { message: "Email verified successfully" } });
      const setUser = vi.fn();

      renderWithProviders(
        <Routes>
          <Route path="/verify-email/:token" element={<VerifyEmail />} />
        </Routes>,
        { user: { name: "Test User", email: "test@example.com", emailVerified: false }, setUser },
        "/verify-email/valid-token-123"
      );

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/users/verify-email", {
          token: "valid-token-123",
        });
      });

      expect(screen.getByText(/email verified/i)).toBeInTheDocument();
      expect(setUser).toHaveBeenCalled();
    });
  });

  describe("Settings Screen", () => {
    const mockUser = {
      _id: "user123",
      name: "Alice Dev",
      email: "alice@example.com",
      emailVerified: true,
      providers: ["google"],
      hasPassword: true,
    };

    it("renders profile, verified badge, linked providers, and logout everywhere", async () => {
      api.get.mockImplementation((url) => {
        if (url === "/users/me") return Promise.resolve({ data: { user: mockUser } });
        return Promise.resolve({ data: { count: 0, notifications: [] } });
      });

      renderWithProviders(<Settings />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText("Account Settings")).toBeInTheDocument();
      });
      expect(screen.getByText("Verified")).toBeInTheDocument();
      expect(screen.getByText("Disconnect")).toBeInTheDocument(); // Google is connected
      expect(screen.getByText("Connect")).toBeInTheDocument(); // GitHub is not connected
      expect(screen.getByRole("button", { name: /log out of all devices/i })).toBeInTheDocument();
    });

    it("allows unlinking provider and triggers DELETE /users/me/providers/:provider", async () => {
      api.get.mockImplementation((url) => {
        if (url === "/users/me") return Promise.resolve({ data: { user: mockUser } });
        return Promise.resolve({ data: { count: 0, notifications: [] } });
      });
      api.delete.mockResolvedValueOnce({
        data: { user: { ...mockUser, providers: [] }, message: "google unlinked" },
      });

      renderWithProviders(<Settings />, { user: mockUser });

      await waitFor(() => {
        expect(screen.getByText("Disconnect")).toBeInTheDocument();
      });

      const disconnectBtn = screen.getByText("Disconnect");
      fireEvent.click(disconnectBtn);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/users/me/providers/google");
      });
    });
  });

  describe("Email Verification Banner in AppLayout", () => {
    it("renders dismissible verification banner when email is unverified", () => {
      const unverifiedUser = {
        name: "Unverified Bob",
        email: "bob@example.com",
        emailVerified: false,
      };

      renderWithProviders(<AppLayout />, { user: unverifiedUser });

      expect(screen.getByRole("region", { name: /email verification notice/i })).toBeInTheDocument();
      expect(screen.getByText(/bob@example.com/)).toBeInTheDocument();

      // Dismiss banner
      const dismissBtn = screen.getByLabelText(/dismiss verification banner/i);
      fireEvent.click(dismissBtn);

      expect(
        screen.queryByRole("region", { name: /email verification notice/i })
      ).not.toBeInTheDocument();
      expect(sessionStorage.getItem("hide_verify_banner")).toBe("true");
    });

    it("does not render verification banner when email is already verified", () => {
      const verifiedUser = {
        name: "Verified Alice",
        email: "alice@example.com",
        emailVerified: true,
      };

      renderWithProviders(<AppLayout />, { user: verifiedUser });

      expect(
        screen.queryByRole("region", { name: /email verification notice/i })
      ).not.toBeInTheDocument();
    });
  });
});
