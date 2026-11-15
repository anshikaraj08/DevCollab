
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Landing from "../screens/Landing";
import Login from "../screens/Login";
import Register from "../screens/Register";
import Invite from "../screens/Invite";
import Room from "../screens/Room";
import { ThemeProvider } from "../context/theme.context";
import { UserContext } from "../context/user.context";
import ToastProvider from "../components/ui/Toast";
import ErrorBoundary from "../components/ErrorBoundary";
import api from "../config/axios";

vi.mock("../config/axios");
vi.mock("@monaco-editor/react", () => ({
  default: () => <div data-testid="monaco-mock">Monaco Editor</div>,
}));

describe("Screen Render Diagnostics", () => {
  it("renders Landing without error", () => {
    render(
      <ErrorBoundary>
        <ThemeProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Landing />
            </MemoryRouter>
          </ToastProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it("renders Login without error", () => {
    render(
      <ErrorBoundary>
        <ThemeProvider>
          <UserContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
            <ToastProvider>
              <MemoryRouter initialEntries={["/login"]}>
                <Login />
              </MemoryRouter>
            </ToastProvider>
          </UserContext.Provider>
        </ThemeProvider>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it("renders Register without error", () => {
    render(
      <ErrorBoundary>
        <ThemeProvider>
          <UserContext.Provider value={{ user: null, setUser: vi.fn(), loading: false }}>
            <ToastProvider>
              <MemoryRouter initialEntries={["/register"]}>
                <Register />
              </MemoryRouter>
            </ToastProvider>
          </UserContext.Provider>
        </ThemeProvider>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it("renders Invite screen without error", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        roomTitle: "Test Room",
        roomId: "123",
        role: "editor",
        invitedBy: "Bob",
        alreadyMember: false,
      },
    });

    render(
      <ErrorBoundary>
        <ThemeProvider>
          <UserContext.Provider value={{ user: { _id: "u1" }, setUser: vi.fn(), loading: false }}>
            <ToastProvider>
              <MemoryRouter initialEntries={["/invite/sampletoken"]}>
                <Routes>
                  <Route path="/invite/:token" element={<Invite />} />
                </Routes>
              </MemoryRouter>
            </ToastProvider>
          </UserContext.Provider>
        </ThemeProvider>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it("renders Room screen without error", async () => {
    api.get.mockResolvedValue({
      data: {
        room: {
          _id: "room123",
          title: "My Room",
          language: "javascript",
          code: "console.log(1)",
          createdBy: "u1",
          role: "owner",
        },
        comments: [],
      },
    });

    render(
      <ErrorBoundary>
        <ThemeProvider>
          <UserContext.Provider value={{ user: { _id: "u1", id: "u1", name: "Alice" }, setUser: vi.fn(), loading: false }}>
            <ToastProvider>
              <MemoryRouter initialEntries={["/room/room123"]}>
                <Routes>
                  <Route path="/room/:roomId" element={<Room />} />
                </Routes>
              </MemoryRouter>
            </ToastProvider>
          </UserContext.Provider>
        </ThemeProvider>
      </ErrorBoundary>
    );
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});

