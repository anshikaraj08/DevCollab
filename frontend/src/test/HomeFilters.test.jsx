
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Home from "../screens/Home";
import { UserContext } from "../context/user.context";
import api from "../config/axios";

vi.mock("../config/axios");

describe("Home Dashboard filters and role badges", () => {
  const mockUser = { _id: "user123", name: "Current User" };
  const mockRooms = [
    {
      _id: "room1",
      title: "My Own Room",
      language: "javascript",
      createdBy: "user123",
      role: "owner",
      memberCount: 2,
    },
    {
      _id: "room2",
      title: "Shared Viewer Room",
      language: "python",
      createdBy: "other_user",
      role: "viewer",
      memberCount: 3,
    },
    {
      _id: "room3",
      title: "Shared Editor Room",
      language: "cpp",
      createdBy: "other_user2",
      role: "editor",
      memberCount: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays all rooms by default and shows role badge on shared rooms", async () => {
    api.get.mockResolvedValueOnce({ data: { rooms: mockRooms } });

    render(
      <UserContext.Provider value={{ user: mockUser }}>
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      </UserContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Own Room")).toBeInTheDocument();
      expect(screen.getByText("Shared Viewer Room")).toBeInTheDocument();
      expect(screen.getByText("Shared Editor Room")).toBeInTheDocument();
    });

    // Check role badges for non-owner rooms
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  it("filters rooms when 'Mine' scope is clicked", async () => {
    api.get.mockResolvedValueOnce({ data: { rooms: mockRooms } });

    render(
      <UserContext.Provider value={{ user: mockUser }}>
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      </UserContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Own Room")).toBeInTheDocument();
    });

    const mineBtn = screen.getByRole("button", { name: "Mine" });
    fireEvent.click(mineBtn);

    expect(screen.getByText("My Own Room")).toBeInTheDocument();
    expect(screen.queryByText("Shared Viewer Room")).not.toBeInTheDocument();
    expect(screen.queryByText("Shared Editor Room")).not.toBeInTheDocument();
  });

  it("filters rooms when 'Shared' scope is clicked", async () => {
    api.get.mockResolvedValueOnce({ data: { rooms: mockRooms } });

    render(
      <UserContext.Provider value={{ user: mockUser }}>
        <BrowserRouter>
          <Home />
        </BrowserRouter>
      </UserContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("My Own Room")).toBeInTheDocument();
    });

    const sharedBtn = screen.getByRole("button", { name: "Shared" });
    fireEvent.click(sharedBtn);

    expect(screen.queryByText("My Own Room")).not.toBeInTheDocument();
    expect(screen.getByText("Shared Viewer Room")).toBeInTheDocument();
    expect(screen.getByText("Shared Editor Room")).toBeInTheDocument();
  });
});

