import type { UserRole } from '@/types/user'

export interface RoleOption {
  value: UserRole
  label: string
  tagType: 'danger' | 'warning' | 'success' | 'info'
}

/** Libellés français + type de tag Element Plus pour chaque rôle. */
export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'admin', label: 'Administrateur', tagType: 'danger' },
  // `success` (vert) distingue visuellement le comptable de l'élève (`info`).
  // Avant : les deux partageaient `info` (doublon signalé en review SEV4).
  { value: 'comptable', label: 'Comptable', tagType: 'success' },
  { value: 'professor', label: 'Professeur', tagType: 'warning' },
  { value: 'student', label: 'Élève', tagType: 'info' },
]

/** Retourne le libellé français d'un rôle ('—' si absent). */
export function roleLabel(role: UserRole | null | undefined): string {
  if (!role) return '—'
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role
}

/** Retourne le type de tag Element Plus associé à un rôle. */
export function roleTagType(role: UserRole | null | undefined): 'danger' | 'warning' | 'success' | 'info' {
  if (!role) return 'info'
  return ROLE_OPTIONS.find((o) => o.value === role)?.tagType ?? 'info'
}