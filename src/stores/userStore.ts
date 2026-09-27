import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppUser, UserRole } from '@/types/user'

/** Clé de stockage de l'utilisateur connecté (localStorage + sessionStorage). */
export const USER_STORAGE_KEY = 'user'

/**
 * Store utilisateur : source de vérité unique de la session courante.
 *
 * CONTRAT PINIA/USER-LOCALSTORAGE :
 * - `setUser()` est le SEUL point d'écriture de la clé `localStorage['user']`.
 * - `clear()` supprime la clé de localStorage ET sessionStorage.
 * - `hydrate()` lit localStorage puis sessionStorage, valide la présence du
 *   champ `role` (sinon purge, ce qui force une reconnexion) et peuple l'état.
 * - Le garde de navigation (src/routes/index.ts) s'appuie sur `hydrate()`
 *   pour conserver le comportement du guard existant (read du localStorage).
 */
export const useUserStore = defineStore('user', () => {
  // --- State ---
  const user = ref<AppUser | null>(null)

  // --- Computed / helpers ---
  const isAdmin = computed(() => user.value?.role === 'admin')

  /** Vrai si l'utilisateur courant a le rôle 'comptable'. */
  const isComptable = computed(() => user.value?.role === 'comptable')

  /**
   * Vrai si l'utilisateur courant peut accéder à la comptabilité
   * (rôles 'admin' ou 'comptable'). Single source pour le menu,
   * le guard router et les `v-if` des vues.
   * Référence canonique — préférer ce getter dans le code nouveau.
   */
  const isAdminOrComptable = computed(() => hasRole('admin', 'comptable'))

  /**
   * Alias sémantique de `isAdminOrComptable` (lisibilité côté vues).
   *
   * @deprecated Préférer `isAdminOrComptable` — conservé pour compatibilité
   *   avec les vues existantes. Ne pas créer de nouveaux usages.
   */
  const canAccessCompta = computed(() => isAdminOrComptable.value)

  /**
   * Initiales pour l'avatar du menu utilisateur.
   * - Si `displayName` présent : première lettre des 2 premiers mots
   *   (ou 2 premiers caractères si un seul mot), en majuscules.
   * - Sinon fallback sur le premier caractère de `username`.
   * - `'?'` si aucun utilisateur.
   */
  const initials = computed(() => {
    const display = user.value?.displayName?.trim()
    if (display) {
      const parts = display.split(/\s+/).filter(Boolean)
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
      return ((parts[0][0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    }
    const uname = user.value?.username?.trim()
    if (uname) return uname[0].toUpperCase()
    return '?'
  })

  /** Vrai si l'utilisateur courant possède l'un des rôles donnés. */
  function hasRole(...roles: UserRole[]): boolean {
    if (!user.value) return false
    return roles.includes(user.value.role)
  }

  // --- Actions ---
  /** Définit l'utilisateur courant et le persiste (unique point d'écriture). */
  function setUser(u: AppUser) {
    user.value = u
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u))
  }

  /**
   * Déconnecte : vide l'état, purge localStorage + sessionStorage,
   * et verrouille le coffre comptable (best-effort, jamais bloquant).
   */
  function clear() {
    user.value = null
    localStorage.removeItem(USER_STORAGE_KEY)
    sessionStorage.removeItem(USER_STORAGE_KEY)
    try {
      const w = window as unknown as {
        ipcRenderer?: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> }
      }
      void w.ipcRenderer?.invoke('comptabilite:lock')?.catch(() => undefined)
    } catch {
      /* best-effort : le backend purge aussi l'unlock en mémoire */
    }
  }

  /**
   * Hydrate l'état depuis localStorage (puis sessionStorage en secours).
   * Retourne l'utilisateur, ou null si absent/invalide (auquel cas on purge
   * les stockages afin de forcer une reconnexion propre).
   */
  function hydrate(): AppUser | null {
    const raw =
      localStorage.getItem(USER_STORAGE_KEY) || sessionStorage.getItem(USER_STORAGE_KEY)
    if (!raw) {
      user.value = null
      return null
    }
    try {
      const parsed = JSON.parse(raw) as AppUser
      // Une entrée sans `role` est un enregistrement obsolète/invalide
      // (utilisateurs créés avant la multi-gestion) → purge + reconnexion.
      if (!parsed || typeof parsed !== 'object' || !parsed.role) {
        clear()
        return null
      }
      user.value = parsed
      return parsed
    } catch {
      clear()
      return null
    }
  }

  return {
    user,
    isAdmin,
    isComptable,
    isAdminOrComptable,
    canAccessCompta,
    initials,
    hasRole,
    setUser,
    clear,
    hydrate,
  }
})