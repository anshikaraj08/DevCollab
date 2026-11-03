// Each collaborator gets one of 8 colors. The matching CSS classes live in index.css.
export const PALETTE_SIZE = 8;
 
export function colorIndexFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % PALETTE_SIZE;
}

