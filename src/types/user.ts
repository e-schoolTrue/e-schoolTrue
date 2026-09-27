/**
 * Rôles utilisateur supportés par l'application.
 * 'admin' accède à la gestion des utilisateurs et au journal d'activité.
 * 'comptable' accède à la comptabilité avancée (avec 'admin').
 */
export type UserRole = 'admin' | 'professor' | 'student' | 'comptable'

/**
 * Utilisateur connecté, tel que stocké dans Pinia (userStore) et
 * persisté dans localStorage/sessionStorage sous la clé 'user'.
 * La clé 'user' est écrite uniquement par `userStore.setUser()`
 * (voir le contrat PINIA/USER-LOCALSTORAGE).
 */
export interface AppUser {
  id: number
  username: string
  displayName: string | null
  role: UserRole
  isActive: boolean
}
