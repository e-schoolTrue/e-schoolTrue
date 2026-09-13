export function getAppreciation(note: number, base = 20): string {
  if (base <= 0) return "Très Insuffisant"
  if (note >= 0.9 * base) return "Excellent"
  if (note >= 0.8 * base) return "Très Bien"
  if (note >= 0.7 * base) return "Bien"
  if (note >= 0.6 * base) return "Assez Bien"
  if (note >= 0.5 * base) return "Passable"
  if (note >= 0.4 * base) return "Insuffisant"
  return "Très Insuffisant"
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0.00'
  return num.toFixed(2)
}
