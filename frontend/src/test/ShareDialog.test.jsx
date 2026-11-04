
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareDialog from "../components/room/ShareDialog";
import { ToastProvider } from "../components/ui/Toast";
import api from "../config/axios";

vi.mock("../config/axios");

describe("ShareDialog component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Invite and People tabs for room owner", async () => {
    api.get.mockResolvedValueOnce({ data: { invites: [] } }); // for invites
    api.get.mockResolvedValueOnce({ data: { members: [] } }); // for members

    render(
      <ToastProvider>
        <ShareDialog
          open={true}
          onClose={() => {}}
          roomId="room123"
          isOwner={true}
          currentUserId="user1"
        />
      </ToastProvider>
    );

    expect(screen.getByRole("button", { name: /Invite Links/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /People/i })).toBeInTheDocument();
    expect(screen.getByText(/create an invite link/i)).toBeInTheDocument();
  });

  it("creates an invite link and shows copy button", async () => {
    api.get.mockResolvedValue({ data: { invites: [], members: [] } });
    api.post.mockResolvedValueOnce({
      data: {
        link: "http://localhost:5173/invite/testtoken123",
        invite: { _id: "inv1", role: "editor", maxUses: 5, uses: 0, expiresAt: new Date().toISOString() },
      },
    });

    render(
      <ToastProvider>
        <ShareDialog
          open={true}
          onClose={() => {}}
          roomId="room123"
          isOwner={true}
          currentUserId="user1"
        />
      </ToastProvider>
    );

    const generateBtn = screen.getByRole("button", { name: /generate invite link/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("http://localhost:5173/invite/testtoken123")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });
  });

  it("renders People tab only for non-owner with Leave Workspace button", async () => {
    api.get.mockResolvedValueOnce({
      data: {
        members: [
          { user: { _id: "owner1", name: "Alice Owner" }, role: "owner" },
          { user: { _id: "member1", name: "Bob Editor" }, role: "editor" },
        ],
      },
    });

    render(
      <ToastProvider>
        <ShareDialog
          open={true}
          onClose={() => {}}
          roomId="room123"
          isOwner={false}
          currentUserId="member1"
          onLeaveWorkspace={() => {}}
        />
      </ToastProvider>
    );

    expect(screen.queryByText(/Invite Links/)).not.toBeInTheDocument();
    expect(screen.getByText(/leave workspace/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Alice Owner/)).toBeInTheDocument();
      expect(screen.getByText(/Bob Editor/)).toBeInTheDocument();
    });
  });
});
