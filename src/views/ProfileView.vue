<script lang="ts" setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useUserStore } from '@/stores/userStore'

/**
 * Page profil : affiche en lecture seule les informations
 * de l'utilisateur connecté depuis le userStore.
 * Redirige vers /login si aucune session.
 */
const router = useRouter()
const userStore = useUserStore()

const user = computed(() => userStore.user)

onMounted(() => {
  if (!userStore.user) {
    userStore.hydrate()
  }
  if (!userStore.user) {
    router.replace('/login').catch(() => {})
  }
})

function goChangePassword() {
  router.push('/change-password').catch(() => {})
}

function goBack() {
  if (window.history.length <= 1) {
    router.replace('/').catch(() => {})
  } else {
    router.back()
  }
}
</script>

<template>
  <div class="profile-page">
    <el-card class="profile-card" shadow="hover">
      <template #header>
        <div class="profile-header">
          <el-space>
            <el-avatar :size="48">{{ userStore.initials }}</el-avatar>
            <div>
              <div class="profile-title">{{ user?.displayName || user?.username || 'Mon profil' }}</div>
              <div class="profile-subtitle">{{ user?.username ?? '—' }} • {{ user?.role ?? '—' }}</div>
            </div>
          </el-space>
        </div>
      </template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="Nom d'utilisateur">
          {{ user?.username ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="Nom affiché">
          {{ user?.displayName ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="Rôle">
          <el-tag>{{ user?.role ?? '—' }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Statut">
          <el-tag :type="user?.isActive ? 'success' : 'danger'">
            {{ user?.isActive ? 'Actif' : 'Inactif' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="ID">
          {{ user?.id ?? '—' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="profile-actions">
        <el-button type="primary" @click="goChangePassword">
          <el-space>
            <Icon icon="mdi:lock" />
            <span>Changer mot de passe</span>
          </el-space>
        </el-button>
        <el-button @click="goBack">Retour</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.profile-card {
  width: 100%;
  max-width: 560px;
}

.profile-header {
  display: flex;
  align-items: center;
}

.profile-title {
  font-size: 18px;
  font-weight: 600;
}

.profile-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  flex-wrap: wrap;
}
</style>
