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

export interface StrictInvokeOptions {
  /**
   * Année scolaire / lecture non critique : pas de toast, log debug seul.
   * L'appelant gère `null` via empty-state explicite (« Aucune année en cours »).
   */
  silent?: boolean
}

function splitSilent(args: unknown[]): { silent: boolean; payload: unknown[] } {
  if (!args.length) return { silent: false, payload: args }
  const last = args[args.length - 1] as Record<string, unknown> | null
  if (last && typeof last === 'object' && !Array.isArray(last) && 'silent' in last) {
    const { silent, ...rest } = last as { silent?: unknown } & Record<string, unknown>
    const isOnlySilent = Object.keys(rest).length === 0
    return {
      silent: silent === true,
      payload: isOnlySilent ? args.slice(0, -1) : [...args.slice(0, -1), rest],
    }
  }
  return { silent: false, payload: args }
}

/**
 * Invocation IPC stricte — montants en prod.
 * Ne retourne jamais un fallback silencieux : lève si IPC absent/échec.
 * Option `{ silent: true }` en dernier argument : pas de `ElMessage`, log
 * debug seul (lectures année non critiques → empty-state, pas de toast).
 *
 * @param channel - Canal IPC.
 * @param args - Arguments transmis au canal (`{ silent: true }` final = option).
 * @returns Donnée IPC typée.
 * @throws {Error} Si IPC indisponible, réponse `{ success: false }` ou donnée nulle.
 */
export async function strictInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const { silent, payload } = splitSilent(args)
  const fail = (msg: string): never => {
    if (silent) {
      if (import.meta.env.DEV) console.debug(`[ipc] "${channel}" silencieux → ${msg}`)
      throw new Error(msg)
    }
    ElMessage.error(msg)
    throw new Error(msg)
  }
  const ipc = getIpc()
  if (!ipc?.invoke) {
    fail(`Canal IPC "${channel}" indisponible (montant non chargé — refus du fallback silencieux)`)
  }
  let res: unknown
  try {
    res = await (ipc as { invoke: (c: string, ...a: unknown[]) => Promise<unknown> }).invoke(channel, ...payload)
  } catch (err) {
    if (silent) {
      if (import.meta.env.DEV) console.debug(`[ipc] "${channel}" échec silencieux`, err)
      throw err instanceof Error ? err : new Error(`Échec IPC "${channel}"`)
    }
    const msg = `Échec IPC "${channel}"`
    ElMessage.error(msg)
    throw err instanceof Error ? err : new Error(msg)
  }
  if (res && typeof res === 'object' && 'success' in (res as Record<string, unknown>)) {
    const r = res as { success?: boolean; data?: T; message?: string }
    if (!r.success || r.data === undefined || r.data === null) {
      const msg = r.message || `Réponse invalide du canal "${channel}" (montant)`
      if (silent) {
        if (import.meta.env.DEV) console.debug(`[ipc] "${channel}" silencieux → ${msg}`)
        throw new Error(msg)
      }
      ElMessage.error(msg)
      throw new Error(msg)
    }
    return r.data
  }
  if (res === undefined || res === null) {
    fail(`Réponse vide du canal "${channel}" (montant)`)
  }
  return res as T
}

/**
 * Lecture fail-soft année : `strictInvoke` silencieux + `null` en échec.
 * Jamais de toast — l'appelant affiche « Aucune année en cours ».
 */
export async function invokeFailSoft<T>(channel: string, ...args: unknown[]): Promise<T | null> {
  try {
    return await strictInvoke<T>(channel, ...args, { silent: true })
  } catch (err) {
    if (import.meta.env.DEV) console.debug(`[ipc] "${channel}" fail-soft → null`, err)
    return null
  }
}

/** Vrai en build prod (`vite build`) — les fallbacks montants y sont interdits. */
export const isProd = import.meta.env.PROD
