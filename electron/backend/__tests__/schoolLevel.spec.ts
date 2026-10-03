/**
 * @vitest-environment node
 * schoolLevel — socle scope par niveau (migration 178).
 * - normalizeSchoolLevel : alias EN/FR, casse/accents, null = global.
 * - periodsForLevel : 2 en secondaire, 3 en primaire/préscolaire (+ global).
 * - levelOfGrade : grade.level prioritaire, repli grade.type legacy.
 * - normalizePeriodName / levelHeading.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeSchoolLevel,
  sameLevel,
  levelOfGrade,
  periodsForLevel,
  periodCountForLevel,
  normalizePeriodName,
  isPeriodForLevel,
  levelHeading,
} from '../lib/schoolLevel';

describe('schoolLevel — scope par niveau', () => {
  it('normalizeSchoolLevel : FR/EN/casse/accents → canon, inconnu → null', () => {
    expect(normalizeSchoolLevel('SECONDAIRE')).toBe('SECONDAIRE');
    expect(normalizeSchoolLevel('secondary')).toBe('SECONDAIRE');
    expect(normalizeSchoolLevel('primaire')).toBe('PRIMAIRE');
    expect(normalizeSchoolLevel('PRIMARY')).toBe('PRIMAIRE');
    expect(normalizeSchoolLevel('préscolaire')).toBe('PRESCOLAIRE');
    expect(normalizeSchoolLevel('PRESCHOOL')).toBe('PRESCOLAIRE');
    expect(normalizeSchoolLevel('maternelle')).toBe('PRESCOLAIRE');
    expect(normalizeSchoolLevel(null)).toBeNull();
    expect(normalizeSchoolLevel('')).toBeNull();
    expect(normalizeSchoolLevel('???')).toBeNull();
  });

  it('sameLevel : null == null (scope global/legacy)', () => {
    expect(sameLevel(null, null)).toBe(true);
    expect(sameLevel('PRIMAIRE', 'primary')).toBe(true);
    expect(sameLevel('PRIMAIRE', 'SECONDAIRE')).toBe(false);
    expect(sameLevel(null, 'PRIMAIRE')).toBe(false);
  });

  it('levelOfGrade : level prioritaire, repli type legacy', () => {
    expect(levelOfGrade({ level: 'SECONDAIRE', type: 'PRIMARY' })).toBe('SECONDAIRE');
    expect(levelOfGrade({ type: 'SECONDARY' })).toBe('SECONDAIRE');
    expect(levelOfGrade({ type: 'PRIMARY' })).toBe('PRIMAIRE');
    expect(levelOfGrade(null)).toBeNull();
    expect(levelOfGrade({})).toBeNull();
  });

  it('periodsForLevel : 2 en secondaire, 3 sinon', () => {
    expect(periodsForLevel('SECONDAIRE')).toEqual(['Semestre 1', 'Semestre 2']);
    expect(periodsForLevel('PRIMAIRE')).toEqual(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
    expect(periodsForLevel('PRESCOLAIRE')).toEqual(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
    expect(periodsForLevel(null)).toEqual(['Trimestre 1', 'Trimestre 2', 'Trimestre 3']);
    expect(periodCountForLevel('SECONDAIRE')).toBe(2);
    expect(periodCountForLevel('PRIMAIRE')).toBe(3);
  });

  it('normalizePeriodName : trim/casse canonique, T1/S2 → canon', () => {
    expect(normalizePeriodName('  trimestre 1 ')).toBe('Trimestre 1');
    expect(normalizePeriodName('SEMESTRE 2')).toBe('Semestre 2');
    expect(normalizePeriodName('T1')).toBe('Trimestre 1');
    expect(normalizePeriodName('S2')).toBe('Semestre 2');
    expect(normalizePeriodName('')).toBe('');
  });

  it('isPeriodForLevel : étanchéité secondaire vs primaire', () => {
    expect(isPeriodForLevel('Semestre 1', 'SECONDAIRE')).toBe(true);
    expect(isPeriodForLevel('Trimestre 1', 'SECONDAIRE')).toBe(false);
    expect(isPeriodForLevel('Trimestre 3', 'PRIMAIRE')).toBe(true);
    expect(isPeriodForLevel('Semestre 2', 'PRIMAIRE')).toBe(false);
  });

  it('levelHeading : heading FR du niveau (reçu/bulletin)', () => {
    expect(levelHeading('PRIMAIRE')).toBe('ÉCOLE PRIMAIRE');
    expect(levelHeading('PRESCOLAIRE')).toBe('ÉCOLE PRÉSCOLAIRE');
    expect(levelHeading('SECONDAIRE')).toBe('ENSEIGNEMENT SECONDAIRE');
    expect(levelHeading(null)).toBe('');
  });
});
