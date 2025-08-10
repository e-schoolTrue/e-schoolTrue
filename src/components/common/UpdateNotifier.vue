<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, reactive } from 'vue'

// Définir les interfaces pour les événements de mise à jour
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
  // Mettre à jour l'état de manière atomique
  Object.assign(state, {
    showUpdateAvailable: true,
    isDownloading: true,
    updateInfo: info,
    updateType: 'info' as const
  })
  
  // Simuler la progression du téléchargement pour le débogage
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
          bytesPerSecond: 1000000, // 1MB/s
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
  // Mettre à jour l'état de manière atomique
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
      console.error('Erreur lors de l\'installation de la mise à jour:', _error)
      const errorMessage = _error instanceof Error ? _error.message : 'Erreur inconnue'
      state.updateType = 'error'
      state.error = errorMessage
      state.isRestarting = false
    }
  } else {
    // Si la mise à jour n'est pas encore téléchargée, la télécharger
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
  // Écouter les événements de mise à jour
  const { autoUpdater } = window.electronAPI
  
  // Configurer les écouteurs d'événements
  const cleanupCallbacks = [
    autoUpdater.onUpdateAvailable(onUpdateAvailable),
    autoUpdater.onUpdateDownloaded(onUpdateDownloaded),
    autoUpdater.onDownloadProgress(onDownloadProgress),
    autoUpdater.onError((error) => {
      console.error('Erreur de mise à jour:', error)
    })
  ]
  
  // Vérifier les mises à jour au chargement du composant
  autoUpdater.checkForUpdates()
  
  // Nettoyer les écouteurs lors du démontage du composant
  onBeforeUnmount(() => {
    cleanupCallbacks.forEach(cleanup => cleanup())
  })
})

// La gestion du nettoyage est maintenant dans onMounted
</script>

<template>
  <div v-if="state.showUpdateAvailable" class="update-notification">
    <el-alert
      :title="updateTitle"
      :type="state.updateType"
      :closable="false"
      show-icon
      :effect="'dark'"
    >
      <template #default>
        <div class="update-message">
          <p>{{ updateMessage }}</p>
        </div>
        <div class="update-actions">
          <el-button 
            v-if="isUpdateDownloaded" 
            type="primary" 
            :loading="state.isRestarting"
            @click="restartApp">
            Redémarrer maintenant
          </el-button>
          <el-button 
            v-else 
            type="primary" 
            :loading="state.isDownloading"
            @click="restartApp">
            Télécharger et installer
          </el-button>
          <el-button 
            v-if="!state.isDownloading && !state.isRestarting" 
            @click="dismissUpdate">
            Plus tard
          </el-button>
        </div>
        <el-progress 
          v-if="state.isDownloading && !isUpdateDownloaded" 
          :percentage="state.downloadProgress" 
          :stroke-width="2"
          :format="(p: number) => `${p}%`"
          class="update-progress"
        />
      </template>
    </el-alert>
  </div>
</template>

<style scoped>
.update-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 350px;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  overflow: hidden;
}

.update-message {
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}

.download-progress {
  margin-top: 12px;
}

.progress-text {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
  text-align: center;
}

:deep(.el-alert) {
  padding: 16px;
}

:deep(.el-alert__title) {
  font-weight: 600;
  font-size: 15px;
}
</style>
