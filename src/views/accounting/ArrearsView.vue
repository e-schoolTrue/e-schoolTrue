<template>
  <div class="acc-page">
    <div class="acc-head">
      <div>
        <h1>Impayés</h1>
        <p>Total restant filtré : <strong>{{ formatMoney(totalReste) }}</strong></p>
      </div>
      <el-button type="success" @click="exportExcel">Exporter Excel</el-button>
    </div>

    <el-card class="acc-card" shadow="hover">
      <div class="acc-filters">
        <el-input v-model="filters.recherche" placeholder="Nom, matricule…" clearable class="acc-f" />
        <el-select v-model="filters.classe" placeholder="Classe" clearable class="acc-f">
          <el-option v-for="c in classes" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filters.statut" placeholder="Statut" clearable class="acc-f">
          <el-option label="Partiel" value="partiel" />
          <el-option label="Impayé" value="impaye" />
        </el-select>
        <el-input-number v-model="filters.montantMin" placeholder="Montant min" :min="0" controls-position="right" class="acc-f" />
        <el-input-number v-model="filters.retardMin" placeholder="Retard min (j)" :min="0" controls-position="right" class="acc-f" />
      </div>
      <ArrearsTable :rows="filtered" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import ArrearsTable from '@/components/accounting/ArrearsTable.vue'
import { useArrears } from '@/composables/useArrears'
import { useCurrency } from '@/composables/useCurrency'

const { store, filters, classes, filtered, totalReste, exportExcel } = useArrears()
const { formatMoney } = useCurrency()

onMounted(() => store.fetchArrears())
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.acc-head h1 { margin: 0; font-size: 22px; }
.acc-card { border-radius: 8px; }
.acc-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.acc-f { flex: 1; min-width: 160px; }
</style>
