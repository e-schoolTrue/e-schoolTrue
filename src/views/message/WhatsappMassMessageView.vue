<template>
  <div class="whatsapp-mass-message">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>Envoi de messages WhatsApp</span>
        </div>
      </template>

      <el-form @submit.prevent="validateAndSendMessages">
        <el-row :gutter="20">
          <el-col :span="24">
            <student-selector 
              :students="students" 
              @selection-changed="updateSelectedStudents"
            />
          </el-col>

          <el-col :span="24" class="mt-4">
            <message-customizer 
              @message-updated="updateCustomMessage"
            />
          </el-col>

          <el-col :span="24" class="mt-4">
            <phone-verification-list 
              :selected-students="selectedStudents"
              @phone-verification-complete="updateVerifiedPhones"
            />
          </el-col>

          <el-col :span="24" class="mt-4">
            <el-button 
              type="primary" 
              :disabled="!canSendMessage"
              @click="validateAndSendMessages"
            >
              <icon-whatsapp class="mr-2" />
              Envoyer les messages
            </el-button>

            <!-- QR Code Modal -->
            <el-dialog 
              v-model="showQRCodeModal" 
              title="Authentification WhatsApp" 
              width="50%"
            >
              <div v-if="qrCode" class="qr-code-container">
                <qrcode-vue :value="qrCode" :size="300" />
              </div>
              <template #footer>
                <span>Veuillez scanner ce QR code avec votre application WhatsApp</span>
              </template>
            </el-dialog>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- Résultats de l'envoi -->
    <el-card v-if="sendResults.length > 0" class="mt-4">
      <template #header>
        <div class="card-header">Résultats de l'envoi</div>
      </template>
      <el-table :data="sendResults" stripe>
        <el-table-column prop="phoneNumber" label="Numéro de téléphone" />
        <el-table-column label="Statut">
          <template #default="scope">
            <el-tag :type="scope.row.success ? 'success' : 'danger'">
              {{ scope.row.success ? 'Envoyé' : 'Échec' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error" label="Erreur" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

import StudentSelector from '@/components/message/student-selector.vue'
import MessageCustomizer from '@/components/message/message-customizer.vue'
import PhoneVerificationList from '@/components/message/phone-verification-list.vue'

// Types
interface Student {
  id: number
  firstname?: string
  lastname?: string
  famillyPhone?: string
  personalPhone?: string
}

interface SendResult {
  phoneNumber: string
  success: boolean
  error?: string
}

interface ResultType {
  success: boolean
  data?: Student[] | SendResult[]
  error?: string | null
  message?: string
}

// États réactifs
const students = ref<Student[]>([])
const selectedStudents = ref<Student[]>([])
const customMessage = ref<string>('')
const verifiedPhones = ref<string[]>([])
const sendResults = ref<SendResult[]>([])
const showQRCodeModal = ref(false)
const qrCode = ref<string | null>(null)

// Hooks de cycle de vie
onMounted(async () => {
  try {
    // Charger les étudiants
    const response = await window.ipcRenderer.invoke('student:all') as ResultType
    if (response.success && response.data) {
      students.value = response.data as Student[]
    } else {
      ElMessage.error('Impossible de charger les étudiants')
    }

    // Écouter les événements WhatsApp
    setupWhatsappListeners()
  } catch (error) {
    ElMessage.error('Erreur de chargement des étudiants')
  }
})




// Configuration des écouteurs d'événements WhatsApp
const setupWhatsappListeners = () => {
  // Écouter l'événement de QR Code
  window.ipcRenderer.on('whatsapp:qr-code', (_event, qr) => {
    qrCode.value = qr
    showQRCodeModal.value = true
  })
}

// Méthodes
const updateSelectedStudents = (students: Student[]) => {
  selectedStudents.value = students
}

const updateCustomMessage = (message: string) => {
  customMessage.value = message
}

const updateVerifiedPhones = (phones: string[]) => {
  verifiedPhones.value = phones
}

const canSendMessage = computed(() => {
  return verifiedPhones.value.length > 0 && customMessage.value.trim() !== ''
})

const validateAndSendMessages = async () => {
  if (!canSendMessage.value) {
    ElMessage.warning('Veuillez sélectionner des destinataires et personnaliser le message')
    return
  }

  try {
    // Vérifier la connexion WhatsApp
    const connectionStatus = await window.ipcRenderer.invoke('whatsapp:is-connected')
    if (!connectionStatus.data) {
      ElMessage.warning('Veuillez vous connecter à WhatsApp')
      return
    }

    // Envoyer les messages via IPC
    const response = await window.ipcRenderer.invoke('whatsapp:send-messages', {
      phoneNumbers: verifiedPhones.value,
      message: customMessage.value
    }) as ResultType

    if (response.success && response.data) {
      sendResults.value = response.data as SendResult[]
      
      // Analyser les résultats
      const successCount = sendResults.value.filter(result => result.success).length
      const failureCount = sendResults.value.filter(result => !result.success).length

      if (successCount > 0) {
        ElMessage.success(`${successCount} message(s) envoyé(s) avec succès`)
      }

      if (failureCount > 0) {
        ElMessage.warning(`${failureCount} message(s) n'ont pas pu être envoyé(s)`)
      }
    } else {
      ElMessage.error('Erreur lors de l\'envoi des messages')
    }
  } catch (error) {
    ElMessage.error('Erreur lors de l\'envoi des messages')
    console.error(error)
  }
}
</script>

<style scoped>
.whatsapp-mass-message {
  max-width: 800px;
  margin: 0 auto;
}
.mt-4 {
  margin-top: 16px;
}
.qr-code-container {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>