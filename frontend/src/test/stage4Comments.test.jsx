import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CommentPanel, { renderFormattedContent } from "../components/room/CommentPanel";
import NotificationBell from "../components/notifications/NotificationBell";
import api from "../config/axios";

// Mock axios
vi.mock("../config/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock socket
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  connected: true,
};

vi.mock("../config/socket", () => ({
  getSocket: vi.fn(() => mockSocket),
  connectSocket: vi.fn(() => mockSocket),
  disconnectSocket: vi.fn(),
}));

describe("Stage 4: Comments v2 & Notifications Frontend", () => {
  const mockUser = {
    _id: "user1",
    id: "user1",
    name: "Alice Author",
    email: "alice@devcollab.io",
    emailVerified: true,
  };

  const mockMembers = [
    { _id: "user1", id: "user1", name: "Alice Author", role: "owner" },
    { _id: "user2", id: "user2", name: "Bob Editor", role: "editor" },
    { _id: "user3", id: "user3", name: "Charlie Viewer", role: "viewer" },
  ];

  const mockComments = [
    {
      _id: "c1",
      line: 10,
      text: "Initial comment by Alice mentioning @Bob Editor",
      author: { id: "user1", name: "Alice Author" },
      mentions: ["user2"],
      replies: [
        {
          author: { id: "user2", name: "Bob Editor" },
          text: "Reply from Bob to @Alice Author",
          mentions: ["user1"],
        },
      ],
      resolved: false,
      editedAt: "2026-11-06T00:00:00.000Z",
    },
    {
      _id: "c2",
      line: 25,
      text: "Comment by Bob",
      author: { id: "user2", name: "Bob Editor" },
      mentions: [],
      replies: [],
      resolved: false,
      editedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Comment Editing Flow", () => {
    it("shows Edit button only for own comments and toggles inline editor", () => {
      render(
        <CommentPanel
          comments={mockComments}
          members={mockMembers}
          currentUserId="user1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onResolve={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Alice is author of c1: Edit button should be visible for c1
      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      expect(editButtons.length).toBe(1);

      // Should show "(edited)" indicator for c1
      expect(screen.getByText("(edited)")).toBeInTheDocument();

      // Click Edit button
      fireEvent.click(editButtons[0]);

      // Inline editor should now be visible with Save and Cancel
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("saves edited comment text and mentions", async () => {
      const handleEdit = vi.fn().mockResolvedValue({});

      render(
        <CommentPanel
          comments={mockComments}
          members={mockMembers}
          currentUserId="user1"
          onAdd={vi.fn()}
          onEdit={handleEdit}
          onResolve={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Open editor
      fireEvent.click(screen.getByRole("button", { name: /edit/i }));

      // Find textarea and change text
      const textarea = screen.getByPlaceholderText(/edit your comment/i);
      fireEvent.change(textarea, { target: { value: "Updated comment text" } });

      // Click Save
      fireEvent.click(screen.getByRole("button", { name: /save/i }));

      await waitFor(() => {
        expect(handleEdit).toHaveBeenCalledWith("c1", "Updated comment text", ["user2"]);
      });
    });

    it("cancels editing on Escape key or Cancel button", () => {
      render(
        <CommentPanel
          comments={mockComments}
          members={mockMembers}
          currentUserId="user1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onResolve={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      const textarea = screen.getByPlaceholderText(/edit your comment/i);
      expect(textarea).toBeInTheDocument();

      // Press Escape to cancel
      fireEvent.keyDown(textarea, { key: "Escape" });
      expect(screen.queryByPlaceholderText(/edit your comment/i)).not.toBeInTheDocument();
    });
  });

  describe("2. Mention Picker & Keyboard Navigation", () => {
    it("renders @mentions in highlighted pill style", () => {
      const rendered = renderFormattedContent("Hello @Bob Editor and @Charlie!");
      render(<div>{rendered}</div>);

      const bobMention = screen.getByText("@Bob Editor");
      expect(bobMention).toBeInTheDocument();
      expect(bobMention.className).toContain("text-primary");
    });

    it("shows member dropdown on typing @ and inserts mention on Enter", () => {
      render(
        <CommentPanel
          comments={mockComments}
          members={mockMembers}
          currentUserId="user1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onResolve={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const newCommentTextarea = screen.getByPlaceholderText(/add a comment/i);

      // Type @Cha
      fireEvent.change(newCommentTextarea, {
        target: { value: "Reviewing this with @Cha", selectionStart: 25 },
      });

      // Member dropdown should appear with Charlie Viewer
      expect(screen.getByText("Charlie Viewer")).toBeInTheDocument();

      // Press Enter to select
      fireEvent.keyDown(newCommentTextarea, { key: "Enter" });

      // Dropdown should close and text should have @Charlie Viewer
      expect(newCommentTextarea.value).toContain("@Charlie Viewer ");
    });

    it("highlights target thread when activeThreadId is provided", () => {
      const { container } = render(
        <CommentPanel
          comments={mockComments}
          members={mockMembers}
          currentUserId="user1"
          activeThreadId="c1"
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onResolve={vi.fn()}
          onReply={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const thread1 = container.querySelector("#thread-c1");
      expect(thread1).toBeInTheDocument();
      expect(thread1.className).toContain("border-primary");
    });
  });

  describe("3. Notification Bell & Live Updates", () => {
    beforeEach(() => {
      api.get.mockImplementation((url) => {
        if (url === "/notifications/unread-count") {
          return Promise.resolve({ data: { count: 3 } });
        }
        if (url.startsWith("/notifications")) {
          return Promise.resolve({
            data: {
              notifications: [
                {
                  _id: "n1",
                  type: "mention",
                  actor: { name: "Bob Editor" },
                  room: { _id: "r1", title: "Project Alpha" },
                  comment: { _id: "c1", text: "Look at this line" },
                  readAt: null,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          });
        }
        return Promise.reject(new Error("Not found"));
      });
    });

    it("renders unread count badge and toggles dropdown", async () => {
      render(
        <MemoryRouter>
          <NotificationBell user={mockUser} />
        </MemoryRouter>
      );

      // Badge should display count 3
      const badge = await screen.findByTestId("notification-badge");
      expect(badge).toHaveTextContent("3");

      // Click bell button to open dropdown
      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      // Notification item should be shown
      expect(await screen.findByText(/mentioned you in a comment/i)).toBeInTheDocument();
      expect(screen.getByText(/"Project Alpha"/i)).toBeInTheDocument();
    });

    it("updates unread count live when socket receives notification:new", async () => {
      let socketHandler = null;
      mockSocket.on.mockImplementation((event, handler) => {
        if (event === "notification:new") socketHandler = handler;
      });

      render(
        <MemoryRouter>
          <NotificationBell user={mockUser} />
        </MemoryRouter>
      );

      await screen.findByTestId("notification-badge");

      // Simulate real-time socket event
      expect(socketHandler).toBeTypeOf("function");
      act(() => {
        socketHandler({
          notification: {
            _id: "n2",
            type: "reply",
            actor: { name: "Charlie Viewer" },
            room: { _id: "r1", title: "Project Alpha" },
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        });
      });

      // Count should increment from 3 to 4
      await waitFor(() => {
        expect(screen.getByTestId("notification-badge")).toHaveTextContent("4");
      });
    });

    it("marks all as read when button is clicked", async () => {
      api.post.mockResolvedValueOnce({ data: { count: 3 } });

      render(
        <MemoryRouter>
          <NotificationBell user={mockUser} />
        </MemoryRouter>
      );

      const bellButton = screen.getByRole("button", { name: /notifications/i });
      fireEvent.click(bellButton);

      const markAllBtn = await screen.findByRole("button", { name: /mark all as read/i });
      fireEvent.click(markAllBtn);

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith("/notifications/read", { all: true });
        expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
      });
    });
  });
});
