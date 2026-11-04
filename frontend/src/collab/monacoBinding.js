import * as Y from "yjs";

/**
 * Keeps a Monaco editor and a Yjs text (Y.Text) identical, and draws other people's cursors.
 * It uses the `monaco` object that @monaco-editor/react gives you in onMount, so no extra
 * Monaco copy is bundled.
 */
export class MonacoBinding {
  constructor({ ytext, editor, monaco, awareness }) {
    this.ytext = ytext;
    this.editor = editor;
    this.monaco = monaco;
    this.awareness = awareness;
    this.model = editor.getModel();
    this.applyingRemote = false;

    // Everyone must use the same line ending, otherwise character positions would differ.
    this.model.setEOL(monaco.editor.EndOfLineSequence.LF);

    this.remoteDecorations = editor.createDecorationsCollection();

    // 1) Start with the shared text, or seed from editor if editor has room code
    const editorVal = this.model.getValue();
    const ytextVal = ytext.toString();
    if (ytextVal.length > 0) {
      this.applyingRemote = true;
      this.model.setValue(ytextVal);
      this.applyingRemote = false;
    } else if (editorVal.length > 0) {
      this.ytext.doc.transact(() => {
        ytext.insert(0, editorVal);
      }, this);
    }

    // 2) editor -> Yjs
    this.modelListener = this.model.onDidChangeContent((event) => this.onEditorChange(event));
    // 3) Yjs -> editor
    this.yObserver = (event, transaction) => this.onSharedChange(event, transaction);
    ytext.observe(this.yObserver);
    // 4) cursors
    this.cursorListener = editor.onDidChangeCursorSelection(() => this.publishSelection());
    this.awarenessListener = () => this.renderRemoteCursors();
    awareness.on("change", this.awarenessListener);
    this.publishSelection();
    this.renderRemoteCursors();

    // 5) Collaborative Undo/Redo Manager (tracks only this binding's local edits)
    this.undoManager = new Y.UndoManager(this.ytext, {
      trackedOrigins: new Set([this]),
    });
    this.onStackChange = null;
    const emitStackChange = () => {
      this.onStackChange?.({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
      });
    };
    this.undoManager.on("stack-item-added", emitStackChange);
    this.undoManager.on("stack-item-popped", emitStackChange);
    this.undoManager.on("stack-cleared", emitStackChange);
  }

  undo() {
    return this.undoManager?.undo();
  }

  redo() {
    return this.undoManager?.redo();
  }

  clearHistory() {
    this.undoManager?.clear();
  }

  canUndo() {
    return (this.undoManager?.undoStack?.length ?? 0) > 0;
  }

  canRedo() {
    return (this.undoManager?.redoStack?.length ?? 0) > 0;
  }

  onEditorChange(event) {
    if (this.applyingRemote) return;                      // this change came from Yjs, do not echo it
    this.ytext.doc.transact(() => {
      // Monaco positions refer to the text before the change. Going from the end of the
      // document to the start keeps every earlier position valid.
      const changes = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
      for (const change of changes) {
        if (change.rangeLength > 0) this.ytext.delete(change.rangeOffset, change.rangeLength);
        if (change.text) this.ytext.insert(change.rangeOffset, change.text);
      }
    }, this);                                             // origin = this binding
  }

  onSharedChange(event, transaction) {
    if (transaction.origin === this) return;              // our own typing, already in the editor
    const edits = [];
    let index = 0;                                        // position in the text BEFORE this change
    for (const part of event.delta) {
      if (part.retain !== undefined) {
        index += part.retain;
      } else if (part.insert !== undefined) {
        const at = this.model.getPositionAt(index);
        edits.push({
          range: { startLineNumber: at.lineNumber, startColumn: at.column, endLineNumber: at.lineNumber, endColumn: at.column },
          text: String(part.insert),
        });
      } else if (part.delete !== undefined) {
        const from = this.model.getPositionAt(index);
        const to = this.model.getPositionAt(index + part.delete);
        edits.push({
          range: { startLineNumber: from.lineNumber, startColumn: from.column, endLineNumber: to.lineNumber, endColumn: to.column },
          text: "",
        });
        index += part.delete;
      }
    }
    this.applyingRemote = true;
    try {
      this.model.applyEdits(edits);
    } finally {
      this.applyingRemote = false;
    }
    this.renderRemoteCursors();
  }

  publishSelection() {
    const selection = this.editor.getSelection();
    if (!selection) return;
    const relative = (lineNumber, column) =>
      Y.relativePositionToJSON(
        Y.createRelativePositionFromTypeIndex(this.ytext, this.model.getOffsetAt({ lineNumber, column })));
    this.awareness.setLocalStateField("cursor", {
      anchor: relative(selection.selectionStartColumn ? selection.selectionStartLineNumber : selection.positionLineNumber, selection.selectionStartColumn || selection.positionColumn),
      head: relative(selection.positionLineNumber, selection.positionColumn),
    });
  }

  indexOf(relativeJson) {
    try {
      const relative = Y.createRelativePositionFromJSON(relativeJson);
      const absolute = Y.createAbsolutePositionFromRelativePosition(relative, this.ytext.doc);
      return absolute && absolute.type === this.ytext ? absolute.index : null;
    } catch {
      return null;
    }
  }

  renderRemoteCursors() {
    const stickiness = this.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges;
    const decorations = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.ytext.doc.clientID || !state.cursor || !state.user) return;
      const anchor = this.indexOf(state.cursor.anchor);
      const head = this.indexOf(state.cursor.head);
      if (anchor === null || head === null) return;
      const color = state.user.colorIndex ?? 0;
      const a = this.model.getPositionAt(anchor);
      const h = this.model.getPositionAt(head);
      if (anchor !== head) {
        const [start, end] = anchor < head ? [a, h] : [h, a];
        decorations.push({
          range: { startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column },
          options: { className: `collab-selection collab-selection-${color}`, stickiness },
        });
      }
      decorations.push({                                   // a small name tag at the cursor
        range: { startLineNumber: h.lineNumber, startColumn: h.column, endLineNumber: h.lineNumber, endColumn: h.column },
        options: { after: { content: state.user.name, inlineClassName: `collab-tag collab-tag-${color}` }, stickiness },
      });
    });
    this.remoteDecorations.set(decorations);
  }

  destroy() {
    this.undoManager?.destroy();
    this.ytext.unobserve(this.yObserver);
    this.modelListener?.dispose();
    this.cursorListener?.dispose();
    this.awareness.off("change", this.awarenessListener);
    this.awareness.setLocalStateField("cursor", null);
    this.remoteDecorations?.clear();
  }
}
