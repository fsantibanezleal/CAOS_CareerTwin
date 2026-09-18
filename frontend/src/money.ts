/**
 * Compact money figures for dense surfaces.
 *
 * The currency is deliberately not part of the figure: every figure on a surface shares
 * one, so it is stated once beside them. Repeating it on each number is what made a
 * salary range wrap onto three lines in an 82px column.
 */
export function compact(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`
  }
  return `${Math.round(value / 1000)}K`
}
