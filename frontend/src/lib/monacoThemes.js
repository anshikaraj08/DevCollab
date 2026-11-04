/**
 * Monaco Editor theme definitions for DevCollab.
 * Reusable across Monaco code editor and Monaco DiffEditor.
 */

export const defineThemes = (monaco) => {
  if (!monaco?.editor) return;
  try {
    monaco.editor.defineTheme("devcollab", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6e7681", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "type", foreground: "ffa657" },
      ],
      colors: {
        "editor.background": "#181818",
        "editorGutter.background": "#181818",
        "editor.lineHighlightBackground": "#222222",
        "editorLineNumber.foreground": "#6e7681",
        "editorLineNumber.activeForeground": "#eff2f6",
        "editor.selectionBackground": "#333a42",
        "editor.inactiveSelectionBackground": "#262b30",
      },
    });

    monaco.editor.defineTheme("devcollab-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "9ca3af", fontStyle: "italic" },
        { token: "keyword", foreground: "dc2626" },
        { token: "string", foreground: "2563eb" },
        { token: "number", foreground: "0891b2" },
        { token: "type", foreground: "d97706" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editorGutter.background": "#ffffff",
        "editor.lineHighlightBackground": "#f8faf8",
        "editorLineNumber.foreground": "#9ca3af",
        "editorLineNumber.activeForeground": "#171717",
        "editor.selectionBackground": "#e0e7ff",
        "editor.inactiveSelectionBackground": "#f1f5f9",
      },
    });
  } catch (_) {}
};

export const defineTheme = defineThemes;

