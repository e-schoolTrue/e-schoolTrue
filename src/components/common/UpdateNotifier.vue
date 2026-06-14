<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, reactive } from 'vue'

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloaded?: boolean;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

const state = reactive({
  showUpdateAvailable: false,
  isDownloading: false,
  isRestarting: false,
  downloadProgress: 0,
  updateInfo: null as UpdateInfo | null,
  updateType: 'info' as 'success' | 'error' | 'info',
  error: null as any,
})

const updateTitle = computed(() => {
  if (state.isDownloading) return 'Téléchargement en cours...'
  if (isUpdateDownloaded.value) return 'Mise à jour prête à être installée'
  return 'Mise à jour disponible'
})

const updateMessage = computed<string>(() => {
  if (state.isDownloading) {
    return `Téléchargement de la version ${state.updateInfo?.version} en cours... ${state.downloadProgress}%`
  } else if (isUpdateDownloaded.value) {
    return `La version ${state.updateInfo?.version} est prête à être installée.`
  } else if (state.updateInfo) {
    return `Une nouvelle version ${state.updateInfo.version} est disponible.`
  }
  return ''
})

const isUpdateDownloaded = computed(() => {
  return state.updateInfo?.downloaded || false
})

const onUpdateAvailable = (info: UpdateInfo) => {
  Object.assign(state, {
    showUpdateAvailable: true,
    isDownloading: true,
    updateInfo: info,
    updateType: 'info' as const
  })

  if (!import.meta.env.PROD) {
    let progress = 0
    const interval = setInterval(() => {
      progress += 5
      if (progress >= 100) {
        clearInterval(interval)
        setTimeout(() => {
          onUpdateDownloaded({
            version: info.version,
            releaseNotes: info.releaseNotes,
            releaseDate: new Date().toISOString()
          } as UpdateInfo)
        }, 500)
      } else {
        onDownloadProgress({
          percent: progress,
          bytesPerSecond: 1000000,
          total: 100,
          transferred: progress
        } as DownloadProgress)
      }
    }, 200)
  }
}

const onDownloadProgress = (progressObj: DownloadProgress) => {
  state.downloadProgress = Math.round(progressObj.percent || 0)
}

const onUpdateDownloaded = (info: UpdateInfo) => {
  state.isDownloading = false
  state.updateInfo = { ...(state.updateInfo || {}), ...info, downloaded: true }
  state.updateType = 'success'
}

const restartApp = async () => {
  if (isUpdateDownloaded.value) {
    state.isRestarting = true
    try {
      await window.electronAPI.autoUpdater.installUpdate()
    } catch (_error) {
      console.error("Erreur lors de l'installation de la mise à jour:", _error)
      const errorMessage = _error instanceof Error ? _error.message : 'Erreur inconnue'
      state.updateType = 'error'
      state.error = errorMessage
      state.isRestarting = false
    }
  } else {
    state.isDownloading = true
    try {
      await window.electronAPI.autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('Erreur lors du téléchargement de la mise à jour:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      state.updateType = 'error'
      state.error = errorMessage
      state.isDownloading = false
    }
  }
}

const dismissUpdate = () => {
  state.showUpdateAvailable = false
}

onMounted(() => {
  const { autoUpdater } = window.electronAPI

  const cleanupCallbacks = [
    autoUpdater.onUpdateAvailable(onUpdateAvailable),
    autoUpdater.onUpdateDownloaded(onUpdateDownloaded),
    autoUpdater.onDownloadProgress(onDownloadProgress),
    autoUpdater.onError((error) => {
      console.error('Erreur de mise à jour:', error)
    })
  ]

  autoUpdater.checkForUpdates()

  onBeforeUnmount(() => {
    cleanupCallbacks.forEach(cleanup => cleanup())
  })
})
</script>

<template>
  <div v-if="state.showUpdateAvailable" class="update-notification">
    <div class="update-card">
      <div class="update-header">
        <div class="update-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>
        <div class="update-header-text">
          <h4 class="update-title">{{ updateTitle }}</h4>
          <p class="update-version" v-if="state.updateInfo">v{{ state.updateInfo.version }}</p>
        </div>
        <button class="update-close" @click="dismissUpdate">&times;</button>
      </div>

      <div class="update-body">
        <p class="update-message">{{ updateMessage }}</p>

        <el-progress
          v-if="state.isDownloading && !isUpdateDownloaded"
          :percentage="state.downloadProgress"
          :stroke-width="4"
          :format="(p: number) => `${p}%`"
          class="update-progress"
        />

        <div class="update-actions">
          <el-button
            v-if="isUpdateDownloaded"
            type="primary"
            :loading="state.isRestarting"
            @click="restartApp"
            size="small"
          >
            Redémarrer maintenant
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="state.isDownloading"
            @click="restartApp"
            size="small"
          >
            Télécharger et installer
          </el-button>
          <el-button
            v-if="!state.isDownloading && !state.isRestarting"
            @click="dismissUpdate"
            size="small"
          >
            Plus tard
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.update-notification {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 380px;
  z-index: 9999;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.update-card {
  background: var(--el-bg-color, #ffffff);
  border: 1px solid var(--el-border-color-light, #e4e7ed);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.update-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px 0;
}

.update-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary, #409EFF) 10%, transparent);
  color: var(--el-color-primary, #409EFF);
  flex-shrink: 0;
}

.update-header-text {
  flex: 1;
  min-width: 0;
}

.update-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  line-height: 1.4;
}

.update-version {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.update-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--el-text-color-placeholder, #C0C4CC);
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
  padding: 0;
  line-height: 1;
  transition: all 0.15s;
}

.update-close:hover {
  background: var(--el-fill-color-light, #f0f0f0);
  color: var(--el-text-color-primary, #303133);
}

.update-body {
  padding: 12px 20px 16px;
}

.update-message {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  line-height: 1.5;
}

.update-progress {
  margin-bottom: 12px;
}

.update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
