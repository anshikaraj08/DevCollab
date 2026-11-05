import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AiReviewPanel from "../components/room/AiReviewPanel";
import { resolveAnchorToLine } from "../lib/anchors";

describe("Stage 3: AI Code Review Frontend", () => {
  const mockReview = {
    _id: "rev1",
    requestedBy: { _id: "user1", name: "Alice Owner" },
    focus: "all",
    summary: "Overall clean code with 3 findings.",
    findings: [
      {
        _id: "f1",
        line: 4,
        severity: "error",
        category: "bug",
        message: "Null dereference hazard",
        suggestion: "if (!item) return null;",
      },
      {
        _id: "f2",
        line: 12,
        severity: "warning",
        category: "performance",
        message: "Expensive computation inside loop",
        suggestion: "const len = arr.length;",
      },
      {
        _id: "f3",
        line: 25,
        severity: "info",
        category: "style",
        message: "Consider const instead of let",
        suggestion: "const x = 10;",
      },
    ],
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AiReviewPanel Component", () => {
    it("renders empty state when no reviews exist", () => {
      render(
        <AiReviewPanel
          reviews={[]}
          activeReview={null}
          canReview={true}
          provider="anthropic"
        />
      );

      expect(screen.getByText(/no ai reviews yet/i)).toBeInTheDocument();
      expect(screen.getByText(/your code is sent to/i)).toBeInTheDocument();
      expect(screen.getByText("anthropic")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /run ai review/i })).toBeInTheDocument();
    });

    it("renders findings grouped by severity (Errors, Warnings, Info)", () => {
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
          provider="anthropic"
        />
      );

      // Summary
      expect(screen.getByText(/overall clean code with 3 findings/i)).toBeInTheDocument();

      // Severity groups
      expect(screen.getByText(/errors \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/warnings \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/info \(1\)/i)).toBeInTheDocument();

      // Finding messages
      expect(screen.getByText("Null dereference hazard")).toBeInTheDocument();
      expect(screen.getByText("Expensive computation inside loop")).toBeInTheDocument();
      expect(screen.getByText("Consider const instead of let")).toBeInTheDocument();
    });

    it("clicking line button calls onJumpToLine", () => {
      const handleJump = vi.fn();
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
          onJumpToLine={handleJump}
        />
      );

      const lineBtn = screen.getByRole("button", { name: /line 4/i });
      fireEvent.click(lineBtn);
      expect(handleJump).toHaveBeenCalledWith(4);
    });

    it("clicking 'Add as comment' calls onAddAsComment with AI suggestion format", async () => {
      const handleAddComment = vi.fn().mockResolvedValue({});
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
          onAddAsComment={handleAddComment}
        />
      );

      const addButtons = screen.getAllByRole("button", { name: /add as comment/i });
      fireEvent.click(addButtons[0]);

      expect(handleAddComment).toHaveBeenCalledWith({
        line: 4,
        content: "AI suggestion: if (!item) return null;",
      });
    });

    it("clicking 'Dismiss' locally removes the finding from the view", () => {
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
        />
      );

      expect(screen.getByText("Null dereference hazard")).toBeInTheDocument();
      const dismissButtons = screen.getAllByRole("button", { name: /dismiss/i });
      fireEvent.click(dismissButtons[0]);

      expect(screen.queryByText("Null dereference hazard")).not.toBeInTheDocument();
      expect(screen.getByText("Expensive computation inside loop")).toBeInTheDocument();
    });

    it("clicking 'Copy' copies suggestion to clipboard", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
        />
      );

      const copyButtons = screen.getAllByRole("button", { name: /copy/i });
      fireEvent.click(copyButtons[0]);

      expect(writeText).toHaveBeenCalledWith("if (!item) return null;");
      expect(await screen.findByText("Copied!")).toBeInTheDocument();
    });

    it("disables 'Run AI review' for viewers (canReview = false)", () => {
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={false}
        />
      );

      expect(screen.queryByRole("button", { name: /run ai review/i })).not.toBeInTheDocument();
    });

    it("triggers review run with selected focus", () => {
      const handleRun = vi.fn();
      render(
        <AiReviewPanel
          reviews={[mockReview]}
          activeReview={mockReview}
          canReview={true}
          onRunReview={handleRun}
        />
      );

      const select = screen.getByLabelText(/review focus/i);
      fireEvent.change(select, { target: { value: "security" } });

      const runBtn = screen.getByRole("button", { name: /run ai review/i });
      fireEvent.click(runBtn);

      expect(handleRun).toHaveBeenCalledWith({ focus: "security" });
    });

    it("shows error banner when error prop is passed", () => {
      render(
        <AiReviewPanel
          reviews={[]}
          activeReview={null}
          canReview={true}
          error="Too many AI review requests. Limit is 5 per hour."
        />
      );

      expect(screen.getByText(/limit is 5 per hour/i)).toBeInTheDocument();
    });

    it("renders collapsible list of earlier reviews and allows selection & deletion", () => {
      const olderReview = {
        _id: "rev2",
        requestedBy: { _id: "user1", name: "Alice Owner" },
        focus: "bugs",
        summary: "Older review summary",
        findings: [],
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      };

      const handleSelect = vi.fn();
      const handleDelete = vi.fn();

      render(
        <AiReviewPanel
          reviews={[mockReview, olderReview]}
          activeReview={mockReview}
          canReview={true}
          onSelectReview={handleSelect}
          onDeleteReview={handleDelete}
          currentUserId="user1"
          roomOwnerId="user1"
        />
      );

      const accordionBtn = screen.getByRole("button", { name: /earlier reviews \(1\)/i });
      fireEvent.click(accordionBtn);

      expect(screen.getByText("Older review summary")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Older review summary"));
      expect(handleSelect).toHaveBeenCalledWith(olderReview);

      const deleteButtons = screen.getAllByTitle("Delete this review");
      fireEvent.click(deleteButtons[1]); // delete older review
      expect(handleDelete).toHaveBeenCalledWith("rev2");
    });
  });

  describe("resolveAnchorToLine", () => {
    it("returns null safely when inputs are missing", () => {
      expect(resolveAnchorToLine(null, null, null)).toBe(null);
      expect(resolveAnchorToLine({}, null, null)).toBe(null);
    });
  });
});
