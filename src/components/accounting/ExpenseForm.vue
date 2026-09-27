<template>
  <el-form :model="form" :rules="rules" ref="formRef" label-width="130px" class="exp-form">
    <el-form-item label="Date" prop="date">
      <el-date-picker v-model="form.date" type="date" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width: 100%" />
    </el-form-item>
    <el-form-item label="Catégorie" prop="categorie">
      <el-select v-model="form.categorie" placeholder="Choisir" style="width: 100%">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
    </el-form-item>
    <el-form-item label="Libellé" prop="libelle">
      <el-input v-model="form.libelle" placeholder="Ex : Achat de craies" />
    </el-form-item>
    <el-form-item label="Montant" prop="montant">
      <el-input-number v-model="form.montant" :min="1" :step="1000" controls-position="right" style="width: 100%" />
    </el-form-item>
    <el-form-item label="Mode" prop="mode">
      <el-select v-model="form.mode" style="width: 100%">
        <el-option label="Espèces" value="Espèces" />
        <el-option label="Mobile Money" value="Mobile Money" />
        <el-option label="Virement" value="Virement" />
        <el-option label="Chèque" value="Chèque" />
      </el-select>
    </el-form-item>
    <el-form-item label="Justificatif">
      <el-upload :auto-upload="false" :on-change="onFile" :limit="1" accept="image/*,.pdf">
        <el-button>Choisir un fichier</el-button>
      </el-upload>
      <span v-if="fileName" class="exp-form__file">{{ fileName }}</span>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="saving" @click="submit">Enregistrer la dépense</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { FormInstance, FormRules, UploadFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useAccountingStore } from '@/stores/accountingStore'
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'
import { safeInvoke } from '@/utils/ipc'

const router = useRouter()

const emit = defineEmits<{ saved: [] }>()
const store = useAccountingStore()

const categories = ['Fournitures', 'Maintenance', 'Salaires', 'Transport', 'Cantine', 'Événement', 'Autre']
const formRef = ref<FormInstance>()
const saving = ref(false)
const fileName = ref('')
const fileContent = ref('')

const form = ref({ date: new Date().toISOString().slice(0, 10), categorie: '', libelle: '', montant: 0, mode: 'Espèces' })

const rules: FormRules = {
  date: [{ required: true, message: 'Date requise', trigger: 'change' }],
  categorie: [{ required: true, message: 'Catégorie requise', trigger: 'change' }],
  libelle: [{ required: true, message: 'Libellé requis', trigger: 'blur' }],
  montant: [{ required: true, message: 'Montant requis', trigger: 'blur' }],
  mode: [{ required: true, message: 'Mode requis', trigger: 'change' }],
}

function onFile(file: UploadFile): void {
  fileName.value = file.name
  const raw = file.raw
  if (!raw) return
  const reader = new FileReader()
  reader.onload = () => {
    fileContent.value = String(reader.result ?? '').split(',')[1] ?? ''
  }
  reader.readAsDataURL(raw)
}

async function uploadJustificatif(): Promise<string | undefined> {
  if (!fileName.value || !fileContent.value) return undefined
  try {
    // Lecture seule fichier : safeInvoke (fallback nom local), jamais de window.ipcRenderer direct.
    const res = await safeInvoke<{ path?: string } | null>('file:upload', null, {
      name: fileName.value,
      type: 'expense',
      content: fileContent.value,
    })
    return res?.path ?? fileName.value
  } catch {
    return fileName.value
  }
}

async function submit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  // Garde d'OUVERTURE « Nouvelle dépense » : popup AVANT upload/IPC.
  // Annuler/NO_SECRET_SET -> ne pas soumettre. Double garde store conservée.
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
    return
  }
  if (!opened) return
  saving.value = true
  try {
    const justificatif = await uploadJustificatif()
    // La garde mot de passe est appliquée dans le store (createExpense).
    await store.createExpense({ ...form.value, justificatif, acteur: 'Comptable' })
    ElMessage.success('Dépense enregistrée')
    form.value = { date: new Date().toISOString().slice(0, 10), categorie: '', libelle: '', montant: 0, mode: 'Espèces' }
    fileName.value = ''
    fileContent.value = ''
    emit('saved')
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.exp-form__file {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
