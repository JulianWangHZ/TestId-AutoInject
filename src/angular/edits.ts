export interface Edit {
  readonly offset: number;
  readonly text: string;
}

/** Apply insertions back to front so earlier offsets stay valid. */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.offset - a.offset)
    .reduce((out, e) => out.slice(0, e.offset) + e.text + out.slice(e.offset), source);
}
