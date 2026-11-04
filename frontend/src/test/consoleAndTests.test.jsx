import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConsoleDrawer from "../components/room/ConsoleDrawer";

describe("ConsoleDrawer & Shared Test Cases Component", () => {
  const roomId = "test-room-123";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("persists stdin to localStorage and displays character counter", () => {
    render(
      <ConsoleDrawer
        open={true}
        onClose={vi.fn()}
        roomId={roomId}
        role="editor"
        running={false}
        output={null}
        onRun={vi.fn()}
        testCases={[]}
        onUpdateTestCases={vi.fn()}
        activeTab="input"
      />
    );

    const textarea = screen.getByPlaceholderText(/type input passed to your program/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "hello world\n42" } });
    expect(textarea.value).toBe("hello world\n42");
    expect(localStorage.getItem(`devcollab:stdin:${roomId}`)).toBe("hello world\n42");
    expect(screen.getByText(/14 \/ 10,000/)).toBeInTheDocument();
  });

  it("loads existing stdin from localStorage for the specific roomId", () => {
    localStorage.setItem(`devcollab:stdin:${roomId}`, "pre-existing stdin data");

    render(
      <ConsoleDrawer
        open={true}
        onClose={vi.fn()}
        roomId={roomId}
        role="editor"
        running={false}
        output={null}
        onRun={vi.fn()}
        testCases={[]}
        onUpdateTestCases={vi.fn()}
        activeTab="input"
      />
    );

    const textarea = screen.getByPlaceholderText(/type input passed to your program/i);
    expect(textarea.value).toBe("pre-existing stdin data");
  });

  it("renders test cases and allows editor to add, update, and run test cases", async () => {
    const handleUpdate = vi.fn();
    const handleRun = vi.fn().mockResolvedValue({
      stdout: "42\n",
      stderr: "",
      code: 0,
    });

    const initialCases = [
      { name: "Sample 1", input: "5 5", expected: "42" },
    ];

    render(
      <ConsoleDrawer
        open={true}
        onClose={vi.fn()}
        roomId={roomId}
        role="editor"
        running={false}
        output={null}
        onRun={handleRun}
        testCases={initialCases}
        onUpdateTestCases={handleUpdate}
        activeTab="tests"
      />
    );

    expect(screen.getByDisplayValue("Sample 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5 5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();

    // Editor can add a new test case
    const addBtn = screen.getByRole("button", { name: /\+ Add/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Case 2")).toBeInTheDocument();
    });

    // Run single test
    const runSingleBtns = screen.getAllByRole("button", { name: /^Run$/i });
    fireEvent.click(runSingleBtns[0]);

    await waitFor(() => {
      expect(handleRun).toHaveBeenCalledWith("5 5");
      expect(screen.getByText(/✓ Pass/)).toBeInTheDocument();
    });
  });

  it("renders fail badge when stdout does not match expected output", async () => {
    const handleRun = vi.fn().mockResolvedValue({
      stdout: "99\n",
      stderr: "",
      code: 0,
    });

    const testCases = [
      { name: "Mismatch Test", input: "10", expected: "42" },
    ];

    render(
      <ConsoleDrawer
        open={true}
        onClose={vi.fn()}
        roomId={roomId}
        role="editor"
        running={false}
        output={null}
        onRun={handleRun}
        testCases={testCases}
        onUpdateTestCases={vi.fn()}
        activeTab="tests"
      />
    );

    const runBtn = screen.getByRole("button", { name: /^Run$/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Fail/i)).toBeInTheDocument();
      expect(screen.getByText(/Expected:/i)).toBeInTheDocument();
      expect(screen.getByText(/Actual:/i)).toBeInTheDocument();
      expect(screen.getByText("99")).toBeInTheDocument();
    });
  });

  it("disables editing, adding, and deleting test cases for viewers", () => {
    const testCases = [
      { name: "Locked Case", input: "test-in", expected: "test-out" },
    ];

    render(
      <ConsoleDrawer
        open={true}
        onClose={vi.fn()}
        roomId={roomId}
        role="viewer"
        running={false}
        output={null}
        onRun={vi.fn()}
        testCases={testCases}
        onUpdateTestCases={vi.fn()}
        activeTab="tests"
      />
    );

    // Read only notice shown
    expect(screen.getByText(/View-only/i)).toBeInTheDocument();
    // No "+ Add" button
    expect(screen.queryByRole("button", { name: /\+ Add/i })).not.toBeInTheDocument();
    // Case name is displayed as static text, not editable input
    expect(screen.getByText("Locked Case")).toBeInTheDocument();
    // Input and expected output textareas are readonly
    expect(screen.getByDisplayValue("test-in")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("test-out")).toHaveAttribute("readonly");
  });
});
