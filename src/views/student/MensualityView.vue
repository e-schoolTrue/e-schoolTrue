<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strictInvoke } from '@/utils/ipc'

/**
 * Mensualités — vue branchée IPC réel, zéro mock.
 * Canal attendu : `payment:mensualites` (ou `mensualite:list`).
 * Échec => empty-state + erreur explicite, aucun chiffre en dur.
 */
const loading = ref(false)
const error = ref<string | null>(null)
const rows = ref<Array<Record<string, unknown>>>([])

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const raw = await strictInvoke<Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> }>('payment:mensualites')
    rows.value = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
    if (!rows.value.length) error.value = null
  } catch (err) {
    rows.value = []
    const msg = err instanceof Error ? err.message : 'Chargement mensualités impossible (zéro mock)'
    error.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mens-page">
    <div class="mens-head">
      <div>
        <h1>Mensualités</h1>
        <p>Échéances mensuelles — données réelles uniquement.</p>
      </div>
      <el-button type="primary" :loading="loading" @click="load">Actualiser</el-button>
    </div>
    <el-card shadow="hover">
      <el-skeleton v-if="loading" :rows="5" animated />
      <el-empty v-else-if="error || !rows.length" :description="error ?? 'Aucune mensualité enregistrée (zéro mock)'" />
      <el-table v-else :data="rows" border stripe style="width: 100%">
        <el-table-column prop="mois" label="Mois" width="140" />
        <el-table-column prop="eleve" label="Élève" min-width="200" />
        <el-table-column prop="montant" label="Montant" width="160" align="right" />
        <el-table-column prop="statut" label="Statut" width="140" align="center" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.mens-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); min-height: calc(100vh - 70px); box-sizing: border-box; }
.mens-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.mens-head h1 { margin: 0; font-size: 22px; }
.mens-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
</style>
  