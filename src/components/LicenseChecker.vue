<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import LicenseView from '../views/omboarding/LicenseView.vue'

const showLicenseView = ref(false)
const daysRemaining = ref<number | null>(null)

const checkLicense = async () => {
  try {
    const result = await window.ipcRenderer.invoke('license:isValid')
    
    if (!result.success) {
      console.error('Erreur de vérification:', result.error)
      ElMessage.error('Erreur lors de la vérification de la licence')
      return
    }

    const { isValid, daysRemaining: days } = result.data
    daysRemaining.value = days

    if (!isValid) {
      await ElMessageBox.alert(
        'Veuillez activer une licence pour continuer à utiliser ce logiciel.',
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