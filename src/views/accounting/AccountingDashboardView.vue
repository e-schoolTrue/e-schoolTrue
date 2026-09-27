<template>
  <div class="acc-page">
    <div class="acc-head">
      <div>
        <h1>Tableau de bord comptable</h1>
        <p>Pilotage des encaissements, impayés, dépenses et caisse.</p>
      </div>
      <el-button type="primary" :loading="store.loading" @click="refresh">Actualiser</el-button>
    </div>

    <div class="acc-kpis">
      <KpiCard label="Encaissé (mois)" :amount="store.kpis.encaisseMois" icon="mdi:cash-plus" color="green" hint="30 derniers jours (IPC)" />
      <KpiCard label="Impayés" :amount="store.kpis.impayesTotal" icon="mdi:alert-circle-outline" color="red" :hint="`${store.kpis.elevesEnRetard} élèves en retard`" />
      <KpiCard label="Dépenses (mois)" :amount="store.kpis.depensesMois" icon="mdi:cart-outline" color="orange" hint="Dépenses validées + en attente" />
      <KpiCard label="Solde caisse" :amount="store.kpis.soldeCaisse" icon="mdi:safe" color="blue" hint="Théorique du jour (IPC)" />
      <KpiCard label="Élèves à jour" :amount="0" :plain="String(store.kpis.elevesAJour)" icon="mdi:account-check-outline" color="green" :hint="`Effectif total : ${store.kpis.effectifTotal}`" />
      <KpiCard label="Élèves en retard" :amount="0" :plain="String(store.kpis.elevesEnRetard)" icon="mdi:account-alert-outline" color="red" hint="Dossiers impayés (IPC)" />
      <KpiCard label="Effectif total" :amount="0" :plain="String(store.kpis.effectifTotal)" icon="mdi:account-group-outline" color="blue" hint="Élèves inscrits" />
      <KpiCard label="Taux recouvrement" :amount="0" :plain="`${store.kpis.tauxRecouvrement} %`" icon="mdi:percent-outline" color="green" hint="À jour / effectif" />
    </div>

    <el-skeleton v-if="store.loading" :rows="4" animated />
    <el-empty v-else-if="store.error && !store.curveLabels.length && !store.arrears.length" :description="store.error" />

    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Flux des 30 derniers jours</strong></template>
          <AccountingCurve :labels="store.curveLabels" :entrees="store.curveEntrees" :sorties="store.curveSorties" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Encaissements par type</strong></template>
          <DonutChart :labels="store.donutTypes.labels" :values="store.donutTypes.values" />
        </el-card>
        <el-card class="acc-card" shadow="hover" style="margin-top: 12px">
          <template #header><strong>Encaissements par mode</strong></template>
          <DonutChart :labels="store.donutModes.labels" :values="store.donutModes.values" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 12px">
      <el-col :xs="24" :sm="12">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Raccourcis</strong></template>
          <div class="acc-links">
            <el-button @click="$router.push('/encaissements')">Encaissements</el-button>
            <el-button @click="$router.push('/impayes')">Impayés</el-button>
            <el-button @click="$router.push('/caisse')">Caisse</el-button>
            <el-button @click="$router.push('/rapports')">Rapports</el-button>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Situation</strong></template>
          <p>Élèves à jour : <strong>{{ store.kpis.elevesAJour }}</strong></p>
          <p>Élèves en retard : <strong>{{ store.kpis.elevesEnRetard }}</strong></p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import KpiCard from '@/components/accounting/KpiCard.vue'
import AccountingCurve from '@/components/accounting/AccountingCurve.vue'
import DonutChart from '@/components/accounting/DonutChart.vue'
import { useAccountingStore } from '@/stores/accountingStore'

const store = useAccountingStore()

function refresh(): Promise<void> {
  return store.fetchDashboard()
}

onMounted(refresh)
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.acc-head h1 { margin: 0; font-size: 24px; color: var(--el-text-color-primary); }
.acc-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
.acc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-bottom: 12px; }
.acc-card { border-radius: 16px; }
.acc-links { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 768px) { .acc-page { padding: 12px 12px 40px; } }
</style>
