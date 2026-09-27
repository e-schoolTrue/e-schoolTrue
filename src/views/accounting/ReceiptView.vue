<template>
  <div class="acc-page">
    <div class="acc-head no-print">
      <el-button @click="$router.back()">Retour</el-button>
      <div class="acc-actions">
        <el-button type="primary" @click="print">Imprimer</el-button>
        <el-button type="danger" @click="pdf">Exporter PDF</el-button>
        <el-button type="success" @click="send">Envoyer</el-button>
      </div>
    </div>

    <el-skeleton v-if="loading" :rows="6" animated />
    <el-empty v-else-if="error || !receipt" :description="error ?? 'Reçu introuvable — aucun reçu chargé (zéro mock)'" />
    <ReceiptTemplate
      v-else
      :school-name="school.name"
      :school-address="school.address"
      :school-phone="school.phone"
      :school-email="school.email"
      :school-year="school.schoolYear || receipt.schoolYear"
      :logo="school.logo"
      :numero="receipt.numero"
      :transaction-ref="receipt.transactionRef"
      :date="receipt.date"
      :recu-de="receipt.recuDe"
      :pour-le-compte-de="receipt.pourLeCompteDe"
      :eleve="receipt.eleve"
      :matricule="receipt.matricule"
      :classe="receipt.classe"
      :motif="receipt.motif"
      :montant="receipt.montant"
      :lettres="montantLettres"
      :mode="receipt.mode"
      :caissier="receipt.caissier"
      :sexe="receipt.sexe"
      :telephone="receipt.telephone"
      :photo="receipt.photoBase64"
      :prenoms="receipt.prenoms"
      :nom="receipt.nom"
      :monthly-grid="receipt.monthlyGrid"
      :tranches="receipt.tranches"
      :annuel="receipt.annuel"
      :prochain-paiement="receipt.prochainPaiement"
      :totaux="receipt.totaux"
      :montant-jour="receipt.montantJour"
      :barcode-value="receipt.barcodeValue"
      :ecole-tels="receipt.ecoleTels"
      :ecole-email="receipt.ecoleEmail"
      :cachet="receipt.cachet"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ReceiptTemplate from '@/components/accounting/ReceiptTemplate.vue'
import { useReceipt } from '@/composables/useReceipt'
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'

const route = useRoute()
const router = useRouter()
const id = String(route.params.id ?? '')
const { loading, error, school, receipt, montantLettres, load, printReceipt, exportPdf, sendReceipt } = useReceipt(id)

function print(): void {
  printReceipt()
}

function pdf(): void {
  exportPdf()
}

async function send(): Promise<void> {
  // Garde d'OUVERTURE « Envoyer » : popup AVANT l'action (double garde : useReceipt re-vérifie au submit IPC).
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
    await sendReceipt()
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
    // Sinon le composable notifie déjà / propage le verrouillage.
  }
}

onMounted(load)
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; margin-bottom: 12px; }
.acc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
@media print {
  .no-print { display: none !important; }
  .acc-page { padding: 0; background: #fff; }
}
</style>
