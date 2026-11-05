import * as Y from "yjs";

/**
 * Resolves a stored Yjs relative position anchor to a 1-based line number
 * in the active Monaco editor model.
 *
 * If the anchored text was deleted or cannot be resolved, returns null (marked as "outdated").
 *
 * @param {Object} anchor - Yjs relative position JSON
 * @param {Y.Text} ytext - Yjs Text instance
 * @param {Object} model - Monaco editor model instance
 * @returns {number|null} 1-based line number or null
 */
export function resolveAnchorToLine(anchor, ytext, model) {
  if (!anchor || !ytext || !model) return null;
  try {
    const relPos = Y.createRelativePositionFromJSON(anchor);
    const absPos = Y.createAbsolutePositionFromRelativePosition(relPos, ytext.doc);
    if (!absPos || absPos.type !== ytext) return null;
    const position = model.getPositionAt(absPos.index);
    return position?.lineNumber ?? null;
  } catch {
    return null;
  }
}
