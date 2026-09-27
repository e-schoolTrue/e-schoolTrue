<template>
  <div class="acc-page">
    <div class="acc-head">
      <div>
        <h1>Dépenses</h1>
        <p>Saisie, justificatifs et historique des sorties.</p>
      </div>
      <CurrencyDisplay :amount="total" class="acc-total" />
    </div>
    <el-row :gutter="16">
      <el-col :xs="24" :lg="9">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Nouvelle dépense</strong></template>
          <ExpenseForm @saved="reload" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="15">
        <el-card class="acc-card" shadow="hover">
          <template #header><strong>Historique</strong></template>
          <ExpenseTable :rows="store.expenses" @approve="approve" @reject="rejectRow" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue'
import ExpenseForm from '@/components/accounting/ExpenseForm.vue'
import ExpenseTable from '@/components/accounting/ExpenseTable.vue'
import { useAccountingStore, type ExpenseRow } from '@/stores/accountingStore'
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'

const store = useAccountingStore()
const router = useRouter()
const total = computed(() => store.expenses.reduce((s, e) => s + e.montant, 0))

function reload(): Promise<void> {
  return store.fetchExpenses()
}

/** Approbation — garde d'OUVERTURE AVANT l'action (popup systématique), double garde store au submit conservée. */
async function approve(row: ExpenseRow): Promise<void> {
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
  try {
    await store.approveExpense(row.id)
    ElMessage.success('Dépense approuvée')
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
  }
}

/** Rejet — garde d'OUVERTURE AVANT l'action (popup systématique), double garde store au submit conservée. */
async function rejectRow(row: ExpenseRow): Promise<void> {
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
  try {
    await store.rejectExpense(row.id)
    ElMessage.success('Dépense rejetée')
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
  }
}

onMounted(reload)
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.acc-head h1 { margin: 0; font-size: 22px; }
.acc-card { border-radius: 8px; }
.acc-total { font-size: 20px; font-weight: 700; }
</style>
