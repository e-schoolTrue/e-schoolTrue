export function getAppreciation(note: number): string {
  if (note < 6) return "Très Faible"
  if (note < 8) return "Faible"
  if (note < 10) return "Insuffisant"
  if (note < 12) return "Passable"
  if (note < 14) return "Assez Bien"
  if (note < 16) return "Bien"
  if (note < 18) return "Très Bien"
  return "Excellent"
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null || isNaN(num)) return '0.00'
  return num.toFixed(2)
}
