/**
 * Play diagram document. Coordinates are normalized 0–1 across the full field
 * (70×40 yd playing field + two 20 yd endzones = 110×40 yd), so a diagram
 * renders identically on phone, tablet and desktop.
 */
export const FIELD_YARDS = { length: 110, width: 40, endzone: 20 } as const;

export type FieldView = 'full' | 'half' | 'endzone';

export interface Token {
  id: string;
  side: 'O' | 'D';
  label: string;
  x: number;
  y: number;
}

export interface Path {
  token: string;
  kind: 'cut' | 'throw' | 'mark';
  points: Array<[number, number]>;
}

export interface Frame {
  tokens: Token[];
  disc: { x: number; y: number; holder?: string };
  paths: Path[];
  note?: string;
}

export interface PlayDiagram {
  field: { orientation: 'vertical' | 'horizontal'; view: FieldView };
  frames: Frame[];
}

export function emptyDiagram(): PlayDiagram {
  return { field: { orientation: 'vertical', view: 'full' }, frames: [{ tokens: [], disc: { x: 0.5, y: 0.5 }, paths: [] }] };
}

/** Linear interpolation of token positions between two frames (for playback animation). */
export function interpolate(a: Frame, b: Frame, t: number): Token[] {
  return a.tokens.map((tok) => {
    const next = b.tokens.find((n) => n.id === tok.id);
    if (!next) return tok;
    return { ...tok, x: tok.x + (next.x - tok.x) * t, y: tok.y + (next.y - tok.y) * t };
  });
}

const in01 = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;

/** Structural validation; returns a list of problems (empty = valid). */
export function validateDiagram(d: unknown): string[] {
  const errs: string[] = [];
  const doc = d as PlayDiagram;
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.frames) || doc.frames.length === 0) {
    return ['diagram must have at least one frame'];
  }
  doc.frames.forEach((f, i) => {
    if (!Array.isArray(f.tokens)) errs.push(`frame ${i}: tokens missing`);
    else f.tokens.forEach((t) => { if (!in01(t.x) || !in01(t.y)) errs.push(`frame ${i}: token ${t.id} out of bounds`); });
    if (!f.disc || !in01(f.disc.x) || !in01(f.disc.y)) errs.push(`frame ${i}: disc out of bounds`);
  });
  return errs;
}
