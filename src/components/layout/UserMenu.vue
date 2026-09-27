<script lang="ts" setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'
import { useUserStore } from '@/stores/userStore'
import { useThemeStore } from '@/stores/themeStore'

/**
 * Menu utilisateur affiché à droite de la barre de navigation.
 * Affiche l'avatar (initiales), le displayName et un dropdown :
 * Mon profil / Changer mot de passe / Déconnexion.
 */
const userStore = useUserStore()
const themeStore = useThemeStore()
const router = useRouter()
const loggingOut = ref(false)

type UserMenuCommand = 'profile' | 'password' | 'logout'

function handleCommand(command: UserMenuCommand) {
  if (command === 'profile') {
    router.push('/profil').catch(() => {})
  } else if (command === 'password') {
    router.push('/change-password').catch(() => {})
  } else if (command === 'logout') {
    void handleLogout()
  }
}

/** Invoque `auth:signOut` avec timeout, garantit clear + redirect même en dev web. */
async function invokeSignOutWithTimeout(timeoutMs = 5000): Promise<unknown> {
  const ipc = (window as unknown as { ipcRenderer?: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer
  if (!ipc || typeof ipc.invoke !== 'function') return Promise.resolve(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      ipc.invoke('auth:signOut'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout auth:signOut')), timeoutMs)
      }),
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function triggerKeydown(event: KeyboardEvent) {
  ;(event.currentTarget as HTMLElement).click()
}

/** Déconnexion idempotente : confirmation, IPC best-effort, purge store + redirect. */
async function handleLogout() {
  if (!userStore.user) {
    await router.replace('/login').catch(() => {})
    return
  }
  if (loggingOut.value) return
  try {
    await ElMessageBox.confirm('Voulez-vous vraiment vous déconnecter ?', 'Déconnexion', {
      confirmButtonText: 'Se déconnecter',
      cancelButtonText: 'Annuler',
      type: 'warning',
    })
  } catch {
    return
  }
  loggingOut.value = true
  let signOutOk = true
  try {
    try {
      await invokeSignOutWithTimeout()
    } catch (err) {
      signOutOk = false
      console.warn('[UserMenu] auth:signOut a échoué (best-effort) :', err)
    }
    if (signOutOk) {
      ElMessage.success('Déconnexion réussie')
    } else {
      ElMessage.warning('Déconnexion locale effectuée (serveur injoignable)')
    }
  } finally {
    userStore.clear()
    loggingOut.value = false
    await router.replace('/login').catch(() => {})
  }
}
</script>

<template>
  <el-dropdown
    trigger="click"
    placement="bottom-end"
    @command="handleCommand"
  >
    <span
      class="user-menu-trigger"
      role="button"
      tabindex="0"
      aria-label="Menu utilisateur"
      @keydown.enter.prevent="triggerKeydown"
      @keydown.space.prevent="triggerKeydown"
      :style="{ color: themeStore.colors.menuText }"
    >
      <el-avatar :size="32" class="user-avatar">{{ userStore.initials }}</el-avatar>
      <span class="user-display-name">{{ userStore.user?.displayName || userStore.user?.username || 'Invité' }}</span>
      <el-icon class="user-caret"><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item disabled>
          <el-space>
            <Icon icon="mdi:account-circle" />
            <span>{{ userStore.user?.username ?? '—' }} • {{ userStore.user?.role ?? '—' }}</span>
          </el-space>
        </el-dropdown-item>
        <el-dropdown-item command="profile">
          <el-space>
            <Icon icon="mdi:account-circle" />
            <span>Mon profil</span>
          </el-space>
        </el-dropdown-item>
        <el-dropdown-item command="password">
          <el-space>
            <Icon icon="mdi:lock" />
            <span>Changer mot de passe</span>
          </el-space>
        </el-dropdown-item>
        <el-dropdown-item command="logout" divided :disabled="loggingOut">
          <el-space>
            <Icon icon="mdi:logout" />
            <span>Déconnexion</span>
          </el-space>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.user-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 0 12px;
  height: 60px;
  outline: none;
}

.user-menu-trigger:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
  border-radius: 4px;
}

.user-avatar {
  flex-shrink: 0;
  font-weight: 600;
}

.user-display-name {
  font-size: 14px;
  white-space: nowrap;
}

.user-caret {
  font-size: 12px;
}

@media (max-width: 767px) {
  .user-display-name {
    display: none;
  }
}
</style>
