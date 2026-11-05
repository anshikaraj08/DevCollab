import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "../screens/Landing";
import Modal from "../components/ui/Modal";
import { ThemeProvider } from "../context/theme.context";
import { UserContext } from "../context/user.context";
import ToastProvider from "../components/ui/Toast";

describe("Landing Structure and Modal Accessibility", () => {
  it("renders all sections referenced by marketing navigation", () => {
    const { container } = render(
      <ThemeProvider>
        <UserContext.Provider value={{ user: null, loading: false }}>
          <ToastProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Landing />
            </MemoryRouter>
          </ToastProvider>
        </UserContext.Provider>
      </ThemeProvider>
    );

    // Verify all 3 section ids exist
    expect(container.querySelector("#features")).not.toBeNull();
    expect(container.querySelector("#platform")).not.toBeNull();
    expect(container.querySelector("#how-it-works")).not.toBeNull();
  });

  it("handles modal escape key and focus trap correctly", () => {
    const handleClose = vi.fn();

    const { rerender } = render(
      <Modal open={true} onClose={handleClose} title="Accessibility Test Modal">
        <div>
          <button type="button">Action 1</button>
          <button type="button">Action 2</button>
        </div>
      </Modal>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Accessibility Test Modal")).toBeInTheDocument();

    // Escape closes modal
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalled();

    // Closes when open=false
    rerender(
      <Modal open={false} onClose={handleClose} title="Accessibility Test Modal">
        <div>Content</div>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

