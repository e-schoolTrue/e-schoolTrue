/**
 * Schedule slots composable - minutes-aware generation
 * Canonical DB timeSlot format is "HH:mm-HH:mm" (e.g. "08:30-09:30")
 * Legacy format "8-9" is still supported for display/comparison.
 */

export interface ScheduleConfigMinutes {
  startHour: number
  startMinutes?: number
  endHour: number
  endMinutes?: number
  slotDuration: number
  lunchStart: number
  lunchStartMinutes?: number
  lunchEnd: number
  lunchEndMinutes?: number
}

/**
 * Format minutes since midnight to label e.g. 480 -> "8h", 510 -> "8h30"
 * @param min - minutes since midnight
 * @returns formatted label
 */
export function formatMinutesLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Format slot label e.g. "8h - 9h30"
 * @param startMin - start minutes since midnight
 * @param endMin - end minutes since midnight
 * @returns label string
 */
export function formatSlotLabel(startMin: number, endMin: number): string {
  return `${formatMinutesLabel(startMin)} - ${formatMinutesLabel(endMin)}`
}

/**
 * Format slot key canonical "HH:mm-HH:mm"
 * @param startMin - start minutes since midnight
 * @param endMin - end minutes since midnight
 * @returns canonical key
 */
export function formatSlotKey(startMin: number, endMin: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}-${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`
}

/**
 * Normalize slot string for comparison (canonical "H:mm-H:mm" without leading zeros).
 * Handles legacy "8-9", "8h-9h", "8h30-9h30" and new "08:00-09:00", "08:30-09:30".
 * @param slot - raw slot string
 * @returns normalized slot e.g. "8:00-9:00" or "8:30-9:30"
 */
export function normSlot(slot: string): string {
  const cleaned = String(slot).trim().toLowerCase().replace(/\s/g, '').replace(/h/g, ':').replace(/::/g, ':')
  // Split on '-' to handle start-end pair
  const parts = cleaned.split('-')
  if (parts.length !== 2) {
    // Fallback: single value normalization
    return cleaned.replace(/^0+(\d)/, '$1')
  }
  const normalizePart = (p: string): string => {
    if (!p) return '0:00'
    // Remove trailing ':' left from "8h" -> "8:"
    const trimmed = p.replace(/:+$/, '')
    if (!trimmed) return '0:00'
    const [hStr, mStr] = trimmed.split(':')
    const h = parseInt(hStr, 10)
    const m = mStr != null && mStr !== '' ? parseInt(mStr, 10) : 0
    const safeH = Number.isNaN(h) ? 0 : h
    const safeM = Number.isNaN(m) ? 0 : m
    return `${safeH}:${String(safeM).padStart(2, '0')}`
  }
  return `${normalizePart(parts[0])}-${normalizePart(parts[1])}`
}

/**
 * Generate slots from minutes-aware config, skipping lunch break.
 * Handles legacy config where minutes fields missing (default 0).
 * @param config - schedule config with hour + optional minutes
 * @returns array of {key, label}
 */
export function generateSlots(config: ScheduleConfigMinutes): { key: string; label: string }[] {
  const slots: { key: string; label: string }[] = []
  const startMin = config.startHour * 60 + (config.startMinutes || 0)
  const endMin = config.endHour * 60 + (config.endMinutes || 0)
  const lunchStartMin = config.lunchStart * 60 + (config.lunchStartMinutes || 0)
  const lunchEndMin = config.lunchEnd * 60 + (config.lunchEndMinutes || 0)
  for (let m = startMin; m < endMin; ) {
    if (m >= lunchStartMin && m < lunchEndMin) {
      m = lunchEndMin
      continue
    }
    const endM = m + config.slotDuration
    if (endM > endMin) break
    slots.push({ key: formatSlotKey(m, endM), label: formatSlotLabel(m, endM) })
    m = endM
  }
  return slots
}

/**
 * Format slot key for display, handling legacy "8-9" and new "08:30-09:30"
 * Legacy "8-9" -> "8h - 9h"
 * New "08:30-09:30" -> "8h30 - 9h30" (strip leading zeros for display)
 * Also handles "08:00-09:00" -> "8h - 9h"
 * @param slot - raw slot key
 * @returns display string
 */
export function formatTimeSlotForDisplay(slot: string): string {
  if (!slot) return ''
  const trimmed = slot.trim()
  if (trimmed.includes(':')) {
    // New format HH:mm-HH:mm
    const parts = trimmed.split('-')
    if (parts.length !== 2) return trimmed
    const fmt = (p: string): string => {
      const [hStr, mStr] = p.split(':')
      const h = parseInt(hStr, 10)
      const m = parseInt(mStr, 10)
      if (Number.isNaN(h)) return p
      if (Number.isNaN(m) || m === 0) return `${h}h`
      return `${h}h${String(m).padStart(2, '0')}`
    }
    return `${fmt(parts[0].trim())} - ${fmt(parts[1].trim())}`
  } else {
    // Legacy "8-9" or "8h-9h"
    const cleaned = trimmed.replace(/h/g, '')
    const parts = cleaned.split('-')
    if (parts.length !== 2) return trimmed
    const a = parseInt(parts[0].trim(), 10)
    const b = parseInt(parts[1].trim(), 10)
    if (Number.isNaN(a) || Number.isNaN(b)) return trimmed
    return `${a}h - ${b}h`
  }
}

/**
 * Default schedule config (8:00-18:00, lunch 12-14, slot 60)
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfigMinutes = {
  startHour: 8,
  startMinutes: 0,
  endHour: 18,
  endMinutes: 0,
  slotDuration: 60,
  lunchStart: 12,
  lunchStartMinutes: 0,
  lunchEnd: 14,
  lunchEndMinutes: 0
}
