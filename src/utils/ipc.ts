import { ElMessage } from 'element-plus'

/**
 * Couche IPC commune — évite les `safeInvoke` dupliqués dans les stores/composables.
 *
 * - `safeInvoke` : tolérant, retourne `fallback` si IPC indisponible ( mocks dev,
 *   données non critiques comme `school:get` ).
 * - `strictInvoke` : pour les montants en prod — ne fallback jamais silencieusement,
 *   lève une exception (appelant : `try/catch` + `ElMessage.error`).
 */

type IpcRenderer = { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> }

function getIpc(): IpcRenderer | undefined {
  const w = window as unknown as { ipcRenderer?: IpcRenderer }
  return w.ipcRenderer
}

function unwrap<T>(res: unknown, fallback: T): T {
  if (res && typeof res === 'object' && 'success' in (res as Record<string, unknown>)) {
    const r = res as { success?: boolean; data?: T }
    if (r.success && r.data !== undefined && r.data !== null) return r.data
    return fallback
  }
  if (res !== undefined && res !== null) return res as T
  return fallback
}

/**
 * Invocation IPC tolérante avec repli.
 *
 * @param channel - Canal IPC (`comptabilite:*`, `cash:*`, ...).
 * @param fallback - Valeur de repli (mocks dev / données non critiques).
 * @param args - Arguments transmis au canal.
 * @returns Donnée IPC ou `fallback` si indisponible.
 */
export async function safeInvoke<T>(channel: string, fallback: T, ...args: unknown[]): Promise<T> {
  try {
    const ipc = getIpc()
    if (!ipc?.invoke) {
      if (import.meta.env.DEV) console.warn(`[ipc] canal "${channel}" sans ipcRenderer → fallback`)
      return fallback
    }
    const res = await ipc.invoke(channel, ...args)
    return unwrap<T>(res, fallback)
  } catch (err) {
    console.warn(`[ipc] "${channel}" erreur → fallback`, err)
    return fallback
  }
}

/**
 * Invocation IPC stricte — montants en prod.
 * Ne retourne jamais un fallback silencieux : lève si IPC absent/échec.
 *
 * @param channel - Canal IPC.
 * @param args - Arguments transmis au canal.
 * @returns Donnée IPC typée.
 * @throws {Error} Si IPC indisponible, réponse `{ success: false }` ou donnée nulle.
 */
export async function strictInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const ipc = getIpc()
  if (!ipc?.invoke) {
    const msg = `Canal IPC "${channel}" indisponible (montant non chargé — refus du fallback silencieux)`
    ElMessage.error(msg)
    throw new Error(msg)
  }
  let res: unknown
  try {
    res = await ipc.invoke(channel, ...args)
  } catch (err) {
    const msg = `Échec IPC "${channel}"`
    ElMessage.error(msg)
    throw err instanceof Error ? err : new Error(msg)
  }
  if (res && typeof res === 'object' && 'success' in (res as Record<string, unknown>)) {
    const r = res as { success?: boolean; data?: T; message?: string }
    if (!r.success || r.data === undefined || r.data === null) {
      const msg = r.message || `Réponse invalide du canal "${channel}" (montant)`
      ElMessage.error(msg)
      throw new Error(msg)
    }
    return r.data
  }
  if (res === undefined || res === null) {
    const msg = `Réponse vide du canal "${channel}" (montant)`
    ElMessage.error(msg)
    throw new Error(msg)
  }
  return res as T
}

/** Vrai en build prod (`vite build`) — les fallbacks montants y sont interdits. */
export const isProd = import.meta.env.PROD
