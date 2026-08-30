<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LicenseView from '../views/omboarding/LicenseView.vue'

/**
 * Statut de licence retourné par le canal IPC `license:getStatus`.
 */
interface LicenseStatus {
  isValid: boolean;
  machineId: string;
  licenseType: 'master' | 'sub' | null;
  customer: string | null;
  expiryDate: string | null;
  daysRemaining: number | null;
  stationIndex: number | null;
  maxStations: number | null;
  /** true si un retour arrière d'horloge a été détecté. */
  clockError?: boolean;
}

/**
 * Réponse du canal IPC `license:getStatus`.
 */
interface GetStatusResponse {
  success: boolean;
  data?: LicenseStatus;
  error?: string;
  message?: string;
}

const showLicenseView = ref(false)
const daysRemaining = ref<number | null>(null)

const checkLicense = async () => {
  try {
    const result = await window.ipcRenderer.invoke('license:getStatus') as GetStatusResponse

    if (!result.success) {
      console.error('Erreur de vérification:', result.error)
      ElMessage.error('Erreur lors de la vérification de la licence')
      return
    }

    const data = result.data
    if (!data) {
      console.error('Erreur de vérification : statut absent de la réponse')
      ElMessage.error('Erreur lors de la vérification de la licence')
      return
    }

    const { isValid, daysRemaining: days, licenseType } = data
    daysRemaining.value = days

    // Retour arrière d'horloge détecté : l'application est bloquée tant que
    // l'horloge système n'est pas réinitialisée. Aucune vue d'activation ne
    // doit s'afficher — corriger l'horloge d'abord.
    if (data.clockError) {
      showLicenseView.value = false
      const clockMsg = (result as any).message as string | undefined || 'L\'horloge système a été reculée. Réinitialisez la date et l\'heure, puis redémarrez l\'application.';
      await ElMessageBox.alert(
        clockMsg,
        'Horloge système modifiée',
        {
          confirmButtonText: 'OK',
          type: 'warning',
          showClose: false,
          closeOnClickModal: false,
          closeOnPressEscape: false
        }
      )
      return
    }

    if (!isValid) {
      // Pas de licence du tout → message d'activation ; licence expirée → message de renouvellement
      const backendMsg = (result as any).message as string | undefined;

      const message = backendMsg || (licenseType === null
        ? 'Veuillez activer une licence pour continuer à utiliser ce logiciel.'
        : 'Votre licence est expirée. Contactez votre revendeur pour la renouveler.');

      await ElMessageBox.alert(
        message,
        'Licence Invalide',
        {
          confirmButtonText: 'Activer une licence',
          type: 'error',
          showClose: false,
          closeOnClickModal: false,
          closeOnPressEscape: false
        }
      )
      showLicenseView.value = true
    } else {
      showLicenseView.value = false

      // Vérifier si la licence expire bientôt
      if (days !== null) {
        if (days <= 7) {
          ElMessage({
            message: `ATTENTION : Votre licence expire dans ${days} jours. Veuillez la renouveler rapidement.`,
            type: 'error',
            duration: 0,
            showClose: true
          })
        } else if (days <= 30) {
          ElMessage({
            message: `Votre licence expire dans ${days} jours. Pensez à la renouveler.`,
            type: 'warning',
            duration: 10000
          })
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de la licence:', error)
    ElMessage.error('Une erreur est survenue lors de la vérification de la licence')
  }
}

const handleLicenseActivated = () => {
  checkLicense() // Vérifie immédiatement le nouveau statut de la licence
}

onMounted(() => {
  checkLicense()
  // Vérifier la licence toutes les 24 heures
  setInterval(checkLicense, 24 * 60 * 60 * 1000)
})
</script>

<template>
  <div class="license-checker">
    <LicenseView 
      v-if="showLicenseView" 
      class="license-modal" 
      @license-activated="handleLicenseActivated"
    />
    <div v-if="showLicenseView" class="overlay"></div>
  </div>
</template>

<style scoped>
.license-checker {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
  pointer-events: none;
}

.license-checker .overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  pointer-events: auto;
}

.license-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  pointer-events: auto;
  background: transparent;
  width: 90%;
  max-width: 600px;
}
</style> 
