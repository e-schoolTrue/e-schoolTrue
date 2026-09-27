import { describe, it, expect } from 'vitest'
import { getAppreciation } from '@/utils/grade'

// ---------------------------------------------------------------------------
// getAppreciation – échelle Guinée/francophone, relative à la base
// (base par défaut : 20)
//   note >= 0.9*base  => "Excellent"
//   note >= 0.8*base  => "Très Bien"
//   note >= 0.7*base  => "Bien"
//   note >= 0.6*base  => "Assez Bien"
//   note >= 0.5*base  => "Passable"
//   note >= 0.4*base  => "Insuffisant"
//   note <  0.4*base  => "Très Insuffisant"
// ---------------------------------------------------------------------------

describe('getAppreciation – base 20 (défaut) : bornes des sept paliers', () => {
  it('Classe 7.9 en Très Insuffisant (sous 0.4*base)', () => {
    expect(getAppreciation(7.9)).toBe('Très Insuffisant')
  })

  it('Classe 0 en Très Insuffisant', () => {
    expect(getAppreciation(0)).toBe('Très Insuffisant')
  })

  it('Classe 8 (borne >= 0.4*base) en Insuffisant', () => {
    expect(getAppreciation(8)).toBe('Insuffisant')
  })

  it('Classe 9.99 en Insuffisant (sous 0.5*base)', () => {
    expect(getAppreciation(9.99)).toBe('Insuffisant')
  })

  it('Classe 10 (borne >= 0.5*base) en Passable', () => {
    expect(getAppreciation(10)).toBe('Passable')
  })

  it('Classe 11.99 en Passable (sous 0.6*base)', () => {
    expect(getAppreciation(11.99)).toBe('Passable')
  })

  it('Classe 12 (borne >= 0.6*base) en Assez Bien', () => {
    expect(getAppreciation(12)).toBe('Assez Bien')
  })

  it('Classe 13.99 en Assez Bien (sous 0.7*base)', () => {
    expect(getAppreciation(13.99)).toBe('Assez Bien')
  })

  it('Classe 14 (borne >= 0.7*base) en Bien', () => {
    expect(getAppreciation(14)).toBe('Bien')
  })

  it('Classe 15.99 en Bien (sous 0.8*base)', () => {
    expect(getAppreciation(15.99)).toBe('Bien')
  })

  it('Classe 16 (borne >= 0.8*base) en Très Bien', () => {
    expect(getAppreciation(16)).toBe('Très Bien')
  })

  it('Classe 17.99 en Très Bien (sous 0.9*base)', () => {
    expect(getAppreciation(17.99)).toBe('Très Bien')
  })

  it('Classe 18 (borne >= 0.9*base) en Excellent', () => {
    expect(getAppreciation(18)).toBe('Excellent')
  })

  it('Classe 20 en Excellent', () => {
    expect(getAppreciation(20)).toBe('Excellent')
  })
})

describe('getAppreciation – base par défaut = 20 quand elle est omise', () => {
  it('Applique base 20 sans argument explicite', () => {
    expect(getAppreciation(16)).toBe('Très Bien')
    expect(getAppreciation(15)).toBe('Bien')
    expect(getAppreciation(13)).toBe('Assez Bien')
    expect(getAppreciation(7)).toBe('Très Insuffisant')
  })
})

describe('getAppreciation – comportement relatif à la base', () => {
  it('base 10 : 5 est Passable (>= 0.5*base)', () => {
    expect(getAppreciation(5, 10)).toBe('Passable')
  })

  it('base 10 : 4 est Insuffisant (>= 0.4*base)', () => {
    expect(getAppreciation(4, 10)).toBe('Insuffisant')
  })

  it('base 10 : 3.99 est Très Insuffisant (sous 0.4*base)', () => {
    expect(getAppreciation(3.99, 10)).toBe('Très Insuffisant')
  })

  it('base 10 : 9 est Excellent (>= 0.9*base)', () => {
    expect(getAppreciation(9, 10)).toBe('Excellent')
  })

  it('base 100 : 90 est Excellent (>= 0.9*base)', () => {
    expect(getAppreciation(90, 100)).toBe('Excellent')
  })

  it('base 100 : 79 est Bien (entre 0.7*base et 0.8*base)', () => {
    expect(getAppreciation(79, 100)).toBe('Bien')
  })

  it('base 100 : 70 (borne >= 0.7*base) est Bien', () => {
    expect(getAppreciation(70, 100)).toBe('Bien')
  })

  it('base 100 : 69 est Assez Bien (entre 0.6*base et 0.7*base)', () => {
    expect(getAppreciation(69, 100)).toBe('Assez Bien')
  })

  it('base 100 : 40 est Insuffisant (>= 0.4*base)', () => {
    expect(getAppreciation(40, 100)).toBe('Insuffisant')
  })

  it('base 100 : 39 est Très Insuffisant (sous 0.4*base)', () => {
    expect(getAppreciation(39, 100)).toBe('Très Insuffisant')
  })
})