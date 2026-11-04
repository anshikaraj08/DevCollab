import * as Y from "yjs";
import { MonacoBinding } from "../collab/monacoBinding";

// Creates a lightweight fake Monaco editor and model
function createFakeEditor(initialText = "") {
  let content = initialText;
  let contentListener = null;

  const model = {
    setEOL: () => {},
    getValue: () => content,
    setValue: (val) => {
      content = val;
    },
    onDidChangeContent: (fn) => {
      contentListener = fn;
      return { dispose: () => { contentListener = null; } };
    },
    applyEdits: (edits) => {
      for (const edit of edits) {
        content = edit.text; // simplified for test
      }
    },
    getPositionAt: (offset) => ({ lineNumber: 1, column: offset + 1 }),
    getOffsetAt: ({ column }) => Math.max(0, column - 1),
  };

  const editor = {
    getModel: () => model,
    createDecorationsCollection: () => ({ set: () => {}, clear: () => {} }),
    onDidChangeCursorSelection: () => ({ dispose: () => {} }),
    getSelection: () => null,
    // Helper to simulate local user typing
    typeText: (binding, offset, text) => {
      content = content.slice(0, offset) + text + content.slice(offset);
      contentListener?.({
        changes: [{ rangeOffset: offset, rangeLength: 0, text }],
      });
    },
  };

  const monaco = {
    editor: {
      EndOfLineSequence: { LF: 1 },
      TrackedRangeStickiness: { NeverGrowsWhenTypingAtEdges: 1 },
    },
  };

  return { editor, model, monaco };
}

describe("Collaborative Undo and Redo", () => {
  it("isolates undo to only the local user's edits and leaves other users' text untouched", () => {
    // Two separate docs synced together
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Bi-directional sync between docA and docB
    docA.on("update", (update) => Y.applyUpdate(docB, update));
    docB.on("update", (update) => Y.applyUpdate(docA, update));

    const ytextA = docA.getText("code");
    const ytextB = docB.getText("code");

    const awarenessA = { on: () => {}, off: () => {}, getStates: () => new Map(), setLocalStateField: () => {} };
    const awarenessB = { on: () => {}, off: () => {}, getStates: () => new Map(), setLocalStateField: () => {} };

    const fakeA = createFakeEditor("");
    const fakeB = createFakeEditor("");

    const bindingA = new MonacoBinding({ ytext: ytextA, editor: fakeA.editor, monaco: fakeA.monaco, awareness: awarenessA });
    const bindingB = new MonacoBinding({ ytext: ytextB, editor: fakeB.editor, monaco: fakeB.monaco, awareness: awarenessB });

    expect(bindingA.canUndo()).toBe(false);
    expect(bindingA.canRedo()).toBe(false);

    // 1. User A types "Hello "
    fakeA.editor.typeText(bindingA, 0, "Hello ");
    expect(ytextA.toString()).toBe("Hello ");
    expect(ytextB.toString()).toBe("Hello ");
    expect(bindingA.canUndo()).toBe(true);
    expect(bindingB.canUndo()).toBe(false); // User B hasn't typed anything yet

    // 2. User B types "World!"
    fakeB.editor.typeText(bindingB, 6, "World!");
    expect(ytextA.toString()).toBe("Hello World!");
    expect(ytextB.toString()).toBe("Hello World!");
    expect(bindingA.canUndo()).toBe(true);
    expect(bindingB.canUndo()).toBe(true);

    // 3. User A presses UNDO -> removes ONLY "Hello ", leaving User B's "World!" intact
    bindingA.undo();
    expect(ytextA.toString()).toBe("World!");
    expect(ytextB.toString()).toBe("World!");
    expect(bindingA.canRedo()).toBe(true);

    // 4. User A presses REDO -> restores "Hello "
    bindingA.redo();
    expect(ytextA.toString()).toBe("Hello World!");
    expect(ytextB.toString()).toBe("Hello World!");

    // 5. User B presses UNDO -> removes User B's "World!", leaving User A's "Hello "
    bindingB.undo();
    expect(ytextA.toString()).toBe("Hello ");
    expect(ytextB.toString()).toBe("Hello ");

    // 6. Test clearHistory()
    bindingA.clearHistory();
    expect(bindingA.canUndo()).toBe(false);
    expect(bindingA.canRedo()).toBe(false);

    bindingA.destroy();
    bindingB.destroy();
  });
});
