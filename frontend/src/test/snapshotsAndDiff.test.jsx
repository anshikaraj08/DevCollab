import { render, screen, fireEvent } from "@testing-library/react";
import HistoryPanel from "../components/room/HistoryPanel";
import DiffView from "../components/room/DiffView";

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: (props) => (
    <div data-testid="diff-editor-mock">
      <span>Diff: {props.original} vs {props.modified}</span>
      <span>Mode: {props.options?.renderSideBySide ? "side-by-side" : "inline"}</span>
    </div>
  ),
}));

describe("HistoryPanel Component", () => {
  const mockSnapshots = [
    {
      _id: "snap1",
      name: "Feature Alpha",
      kind: "manual",
      createdBy: { _id: "user_owner", name: "Alice Owner" },
      createdAt: new Date().toISOString(),
    },
    {
      _id: "snap2",
      name: "Pre-restore checkpoint",
      kind: "pre-restore",
      createdBy: { _id: "user_editor", name: "Bob Editor" },
      createdAt: new Date().toISOString(),
    },
  ];

  it("renders snapshots with kind badge and author", () => {
    render(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="owner"
        currentUserId="user_owner"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.getByText("Feature Alpha")).toBeInTheDocument();
    expect(screen.getByText("Pre-restore checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Pre-restore")).toBeInTheDocument();
    expect(screen.getByText("Alice Owner")).toBeInTheDocument();
    expect(screen.getByText("Bob Editor")).toBeInTheDocument();
  });

  it("shows Save version and Restore buttons for owner and editor, but hides for viewer", () => {
    const { rerender } = render(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="editor"
        currentUserId="user_editor"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.getByText("+ Save version")).toBeInTheDocument();
    expect(screen.getAllByText("Restore")).toHaveLength(2);

    // Rerender as viewer
    rerender(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="viewer"
        currentUserId="user_viewer"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.queryByText("+ Save version")).not.toBeInTheDocument();
    expect(screen.queryByText("Restore")).not.toBeInTheDocument();
  });

  it("enforces delete button visibility: owner sees all, editor sees own, viewer sees none", () => {
    // Owner sees delete for both
    const { rerender } = render(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="owner"
        currentUserId="user_owner"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.getAllByTitle(/Delete this snapshot/i)).toHaveLength(2);

    // Editor sees delete only for snap2 (their own)
    rerender(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="editor"
        currentUserId="user_editor"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.getAllByTitle(/Delete this snapshot/i)).toHaveLength(1);

    // Viewer sees no delete buttons
    rerender(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="viewer"
        currentUserId="user_viewer"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={vi.fn()}
      />
    );

    expect(screen.queryByTitle(/Delete this snapshot/i)).not.toBeInTheDocument();
  });

  it("calls onCompare callback when Compare is clicked", () => {
    const handleCompare = vi.fn();
    render(
      <HistoryPanel
        snapshots={mockSnapshots}
        role="viewer"
        currentUserId="user_viewer"
        onSaveVersion={vi.fn()}
        onRestore={vi.fn()}
        onDelete={vi.fn()}
        onCompare={handleCompare}
      />
    );

    const compareButtons = screen.getAllByText("Compare");
    fireEvent.click(compareButtons[0]);

    expect(handleCompare).toHaveBeenCalledWith(mockSnapshots[0]);
  });
});

describe("DiffView Overlay Component", () => {
  const mockSnapshots = [
    { _id: "snap1", name: "Version 1", kind: "manual" },
    { _id: "snap2", name: "Version 2", kind: "pre-restore" },
  ];

  it("renders comparison controls and diff editor", async () => {
    const handleClose = vi.fn();
    render(
      <DiffView
        open={true}
        onClose={handleClose}
        snapshots={mockSnapshots}
        currentCode="console.log('live');"
        language="javascript"
        isDark={true}
        fetchSnapshotCode={vi.fn().mockResolvedValue("console.log('snap');")}
      />
    );

    expect(screen.getByText("Compare:")).toBeInTheDocument();
    expect(screen.getByText("Side-by-side")).toBeInTheDocument();
    expect(screen.getByText("Inline")).toBeInTheDocument();
    expect(screen.getByTestId("diff-editor-mock")).toBeInTheDocument();

    // Toggle to inline
    fireEvent.click(screen.getByText("Inline"));
    expect(screen.getByText(/Mode: inline/i)).toBeInTheDocument();

    // Close button
    fireEvent.click(screen.getByLabelText("Close diff view"));
    expect(handleClose).toHaveBeenCalled();
  });
});

