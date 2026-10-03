import { describe, it, expect } from 'vitest'
import {
  adaptReferencePeriods,
  buildPresetPeriods,
  levelForGradeType,
  normalizeLevel,
  periodBadgeForLevel,
} from '@/types/schoolLevel'

/**
 * Socle 3 niveaux — presets et mappings.
 * - PRESCOLAIRE/PRIMAIRE : 3 trimestres ; SECONDAIRE : 2 semestres.
 * - `adaptReferencePeriods` : ventilation d'une année legacy (copie de dates).
 */
describe('schoolLevel presets (3 niveaux)', () => {
  it('badges régime par niveau', () => {
    expect(periodBadgeForLevel('PRESCOLAIRE')).toBe('Trimestres')
    expect(periodBadgeForLevel('PRIMAIRE')).toBe('Trimestres')
    expect(periodBadgeForLevel('SECONDAIRE')).toBe('Semestres')
  })

  it('presets 2024-2025 : 3 trimestres vs 2 semestres', () => {
    const tri = buildPresetPeriods('PRIMAIRE', '2024-2025')
    expect(tri).toHaveLength(3)
    expect(tri[0]).toMatchObject({ name: 'Trimestre 1', start: '2024-09-02', end: '2024-12-20' })
    expect(tri[2]).toMatchObject({ name: 'Trimestre 3', start: '2025-03-31', end: '2025-06-30' })
    const sem = buildPresetPeriods('SECONDAIRE', '2024-2025')
    expect(sem).toHaveLength(2)
    expect(sem[0]).toMatchObject({ name: 'Semestre 1', start: '2024-09-02', end: '2025-01-31' })
    expect(sem[1]).toMatchObject({ name: 'Semestre 2', start: '2025-02-03', end: '2025-06-30' })
  })

  it('référence legacy id2 (trimestres 2025-2026) → préscolaire copie les dates', () => {
    const ref = [
      { name: 'Trimestre 1', start: '2025-10-06', end: '2025-12-31' },
      { name: 'Trimestre 2', start: '2026-01-01', end: '2026-04-18' },
      { name: 'Trimestre 3', start: '2026-04-19', end: '2026-06-30' },
    ]
    const pre = adaptReferencePeriods(ref, 'PRESCOLAIRE', '2025-2026')
    expect(pre).toHaveLength(3)
    expect(pre[0]).toMatchObject({ name: 'Trimestre 1', start: '2025-10-06', end: '2025-12-31' })
  })

  it('référence legacy id1 (semestres 2025-2026) → secondaire garde les dates', () => {
    const ref = [
      { name: 'Semestre 1', start: '2025-10-06', end: '2026-02-15' },
      { name: 'Semestre 2', start: '2026-02-16', end: '2026-06-30' },
    ]
    const sec = adaptReferencePeriods(ref, 'SECONDAIRE', '2025-2026')
    expect(sec).toHaveLength(2)
    expect(sec[0]).toMatchObject({ name: 'Semestre 1', start: '2025-10-06', end: '2026-02-15' })
  })

  it('3 trimestres → 2 semestres : 1er gardé, suite fusionnée', () => {
    const ref = [
      { name: 'Trimestre 1', start: '2025-10-06', end: '2025-12-31' },
      { name: 'Trimestre 2', start: '2026-01-01', end: '2026-04-18' },
      { name: 'Trimestre 3', start: '2026-04-19', end: '2026-06-30' },
    ]
    const sec = adaptReferencePeriods(ref, 'SECONDAIRE', '2025-2026')
    expect(sec).toHaveLength(2)
    expect(sec[1]).toMatchObject({ name: 'Semestre 2', start: '2026-01-01', end: '2026-06-30' })
  })

  it('normalizeLevel tolère alias legacy', () => {
    expect(normalizeLevel('SECONDARY')).toBe('SECONDAIRE')
    expect(normalizeLevel('primary')).toBe('PRIMAIRE')
    expect(normalizeLevel('preschool')).toBe('PRESCOLAIRE')
    expect(normalizeLevel(null)).toBeNull()
    expect(normalizeLevel('xxx')).toBeNull()
  })

  it('levelForGradeType mappe les classes vers les 3 niveaux', () => {
    expect(levelForGradeType('SECONDARY')).toBe('SECONDAIRE')
    expect(levelForGradeType('PRIMARY')).toBe('PRIMAIRE')
    expect(levelForGradeType('PRESCOLAIRE')).toBe('PRESCOLAIRE')
    expect(levelForGradeType(undefined)).toBe('PRIMAIRE')
  })
})
