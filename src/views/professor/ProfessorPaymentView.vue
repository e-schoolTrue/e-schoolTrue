<template>
  <el-container class="professor-payment">
    <el-header class="payment-header">
      <el-row :gutter="15">
        <el-col :xs="24" :sm="12">
          <el-card shadow="hover" class="stat-card">
            <div class="compact-stat-content">
              <div class="stat-info">
                <el-icon size="18"><User /></el-icon>
                <span class="stat-label">Total Professeurs</span>
              </div>
              <span class="stat-value">{{ totalProfessors }}</span>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-card shadow="hover" class="stat-card primary">
            <div class="compact-stat-content">
              <div class="stat-info">
                <el-icon size="18"><Money /></el-icon>
                <span class="stat-label">Total Payé</span>
              </div>
              <currency-display class="stat-amount" :amount="totalPaid" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-header>

    <el-main class="payment-content">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <!-- ONGLET 1 : Heures mensuelles (repris de TeacherPayView) -->
        <el-tab-pane label="Heures mensuelles" name="heures">
          <div class="pay-head">
            <div class="pay-actions">
              <el-select v-model="mois" placeholder="Mois" style="width: 150px">
                <el-option v-for="m in moisOptions" :key="m.value" :label="m.label" :value="m.value" />
              </el-select>
              <el-select v-model="annee" placeholder="Année" style="width: 120px">
                <el-option v-for="y in anneeOptions" :key="y" :label="String(y)" :value="y" />
              </el-select>
              <el-button type="primary" :loading="hoursLoading" @click="chargerHeures">Charger heures</el-button>
              <el-button type="success" :loading="payingAll" :disabled="!selectedHourIds.length || payingAll" @click="validerEtPayer">Valider et payer</el-button>
            </div>
          </div>
          <el-card class="pay-card" shadow="hover">
            <el-skeleton v-if="hoursLoading" :rows="5" animated />
            <el-empty v-else-if="hoursError" :description="hoursError" />
            <el-empty v-else-if="!accStore.teacherHours.length" description="Aucune heure pour cette période — changez Mois / Année (zéro mock)" />
            <div v-else>
              <HourLogTable :rows="accStore.teacherHours" @view="goSlip" @validate="validateRow" @pay="payRow" @select="selectHourRow" />
              <div class="pay-select">
                <el-checkbox-group v-model="selectedHourIds">
                  <el-checkbox v-for="r in accStore.teacherHours" :key="r.id" :value="r.id">{{ r.firstname }} {{ r.lastname }}</el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </el-card>
          <el-card v-if="currentHour" class="pay-card pay-panel" shadow="hover">
            <template #header><strong>Détails — {{ currentHour.firstname }} {{ currentHour.lastname }}</strong></template>
            <el-form label-width="150px" class="pay-form">
              <el-row :gutter="16">
                <el-col :xs="24" :md="12">
                  <el-form-item label="Heures"><el-input-number v-model="hourDetail.heures" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                  <el-form-item label="Tarif"><el-input-number v-model="hourDetail.tarif" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                  <el-form-item label="Sous-total"><el-input :value="formatMoney(heureSousTotal)" disabled /></el-form-item>
                  <el-form-item label="Prime"><el-input-number v-model="hourDetail.prime" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                  <el-form-item label="Transport"><el-input-number v-model="hourDetail.transport" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                </el-col>
                <el-col :xs="24" :md="12">
                  <el-form-item label="Avance"><el-input-number v-model="hourDetail.avance" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                  <el-form-item label="Retenue"><el-input-number v-model="hourDetail.retenue" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
                  <el-form-item label="Montant à payer"><el-input :value="formatMoney(heureMontantAPayer)" disabled /></el-form-item>
                  <el-form-item label="Mode">
                    <el-select v-model="hourDetail.mode" style="width: 100%">
                      <el-option label="Espèces" value="cash" />
                      <el-option label="Orange Money" value="orange_money" />
                      <el-option label="MTN Mobile Money" value="mtn_money" />
                      <el-option label="Virement" value="transfer" />
                      <el-option label="Chèque" value="check" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="Téléphone"><el-input v-model="hourDetail.telephone" placeholder="Téléphone enseignant" /></el-form-item>
                  <el-form-item label="Observation"><el-input v-model="hourDetail.observation" type="textarea" :rows="2" /></el-form-item>
                </el-col>
              </el-row>
              <p class="pay-words">En lettres : <em>{{ amountInWords(heureMontantAPayer) }}</em></p>
              <div class="pay-actions">
                <el-button type="primary" :loading="hourSaving" :disabled="hourSaving" @click="enregistrerHeure">Enregistrer</el-button>
                <el-button @click="ouvrirDialogDepuisHeure">Ouvrir paiement</el-button>
              </div>
            </el-form>
          </el-card>
        </el-tab-pane>

        <!-- ONGLET 2 : Paiements -->
        <el-tab-pane label="Paiements" name="paiements">
          <el-card class="payment-table-card" shadow="hover">
            <template #header>
              <div class="table-header">
                <div class="search-filters">
                  <el-input v-model="filters.professorName" placeholder="Rechercher un professeur..." clearable class="search-input" @input="handleFilter">
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                  <el-date-picker v-model="filters.month" type="month" placeholder="Mois" format="MMMM YYYY" value-format="YYYY-MM" class="filter-date" @change="loadPayments" />
                </div>
                <div class="table-actions">
                  <el-button-group>
                    <el-tooltip content="Exporter vers Excel" placement="top">
                      <el-button type="success" :icon="Download" :loading="loading" @click="exportToExcel">Exporter</el-button>
                    </el-tooltip>
                    <el-tooltip content="Nouveau paiement" placement="top">
                      <el-button type="primary" :icon="Plus" @click="showNewPaymentDialog">Paiement</el-button>
                    </el-tooltip>
                    <el-tooltip content="Actualiser les données" placement="top">
                      <el-button type="info" :icon="Refresh" :loading="loading" @click="refreshData">Actualiser</el-button>
                    </el-tooltip>
                  </el-button-group>
                </div>
              </div>
            </template>
            <el-table v-loading="loading" :data="filteredPayments" height="35vh" border stripe style="width: 100%" :max-height="350">
              <el-table-column label="Professeur" min-width="250">
                <template #default="{ row }">
                  <div class="professor-info">
                    <el-avatar :size="32">{{ getInitials(row.professor) }}</el-avatar>
                    <div class="professor-details">
                      <span>{{ row.professor.firstname }} {{ row.professor.lastname }}</span>
                      <small>{{ getTeachingInfo(row.professor) }}</small>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="Référence" prop="reference" width="170">
                <template #default="{ row }"><el-tag type="info">{{ row.reference || `PAY-ENS-${row.id}` }}</el-tag></template>
              </el-table-column>
              <el-table-column label="Type" prop="type" width="130">
                <template #default="{ row }"><el-tag :type="getPaymentTypeColor(row.type)">{{ formatPaymentType(row.type) }}</el-tag></template>
              </el-table-column>
              <el-table-column label="Montant" prop="amount" width="150" align="right">
                <template #default="{ row }"><currency-display :amount="row.amount" /></template>
              </el-table-column>
              <el-table-column label="Mode" prop="paymentMethod" width="140">
                <template #default="{ row }">{{ formatPaymentMethod(row.paymentMethod) }}</template>
              </el-table-column>
              <el-table-column label="Date" prop="createdAt" width="120">
                <template #default="{ row }">{{ formatDateJJMMAAAA(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="Actions" width="150" fixed="right" align="center">
                <template #default="{ row }">
                  <el-button-group>
                    <el-button type="primary" circle size="small" :icon="Printer" @click="goBulletin(row)" />
                    <el-button type="warning" circle size="small" :icon="Edit" @click="editPayment(row)" />
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-tab-pane>

        <!-- ONGLET 3 : Bulletins -->
        <el-tab-pane label="Bulletins" name="bulletins">
          <div class="bulletin-layout">
            <el-card class="bulletin-list" shadow="hover">
              <template #header><strong>Bulletins ({{ filteredPayments.length }}) — N° PAY-ENS backend</strong></template>
              <el-table :data="filteredPayments" border stripe highlight-current-row style="width: 100%" empty-text="Aucun paiement — aucun bulletin (zéro mock)" @row-click="selectBulletin">
                <el-table-column label="N° Bulletin" width="180">
                  <template #default="{ row }"><strong>{{ row.reference || `PAY-ENS-${row.id}` }}</strong></template>
                </el-table-column>
                <el-table-column label="Enseignant" min-width="180">
                  <template #default="{ row }">{{ row.professor.firstname }} {{ row.professor.lastname }}</template>
                </el-table-column>
                <el-table-column label="Période" width="130">
                  <template #default="{ row }">{{ formatPeriode(row.month) }}</template>
                </el-table-column>
                <el-table-column label="Net" width="140" align="right">
                  <template #default="{ row }"><currency-display :amount="row.netAmount ?? row.amount" /></template>
                </el-table-column>
                <el-table-column label="Voir" width="80" align="center">
                  <template #default="{ row }"><el-button size="small" type="primary" @click.stop="selectBulletin(row)">Voir</el-button></template>
                </el-table-column>
              </el-table>
            </el-card>
            <el-card v-if="bulletin" class="bulletin-preview" shadow="hover">
              <template #header>
                <div class="bulletin-head">
                  <strong>Bulletin {{ bulletin.reference || `PAY-ENS-${bulletin.id}` }}</strong>
                  <div class="bulletin-actions">
                    <el-button size="small" type="primary" @click="printBulletin">Imprimer</el-button>
                    <el-button size="small" type="danger" @click="exportBulletinPdf">Exporter PDF</el-button>
                  </div>
                </div>
              </template>
              <div id="bulletin-print-zone">
                <SalarySlipPreview
                  :school-name="schoolName"
                  :school-address="schoolAddress"
                  :school-phone="schoolPhone"
                  :school-email="schoolEmail"
                  :school-year="schoolYear"
                  :periode="formatPeriode(bulletin.month)"
                  :numero="bulletin.reference || `PAY-ENS-${bulletin.id}`"
                  :enseignant="`${bulletin.professor.firstname} ${bulletin.professor.lastname}`"
                  :matiere="getTeachingInfo(bulletin.professor)"
                  :heures="bulletinHours"
                  :tarif-horaire="bulletinRate"
                  :sous-total="bulletinSousTotal"
                  :prime="bulletinPrime"
                  :transport="bulletinTransport"
                  :avance="bulletinAvance"
                  :retenue="bulletinRetenue"
                  :brut="bulletinBrut"
                  :deductions="bulletinDeductions"
                  :date="formatDateJJMMAAAA(bulletin.createdAt)"
                  :mode="formatPaymentMethod(bulletin.paymentMethod)"
                  :telephone="bulletinPhone"
                  :lettres="amountInWords(bulletin.netAmount ?? bulletin.amount ?? 0)"
                />
              </div>
            </el-card>
            <el-empty v-else description="Sélectionnez un bulletin (N° PAY-ENS backend)" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-main>

    <professor-payment-dialog
      v-model:visible="paymentDialogVisible"
      :professor="selectedProfessor"
      :payment="selectedPayment"
      :hour-prefill="hourPrefill"
      @payment-added="handlePaymentAdded"
    />
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Plus, Download, Printer, Edit, Money, User, Refresh, Search } from '@element-plus/icons-vue';
import { jsPDF } from 'jspdf';
import printJS from 'print-js';
import * as XLSX from 'xlsx';
import ProfessorPaymentDialog from '@/components/professor/ProfessorPaymentDialog.vue';
import HourLogTable from '@/components/accounting/HourLogTable.vue';
import SalarySlipPreview from '@/components/accounting/SalarySlipPreview.vue';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';
import { useAccountingStore, type TeacherHourRow } from '@/stores/accountingStore';
import { strictInvoke } from '@/utils/ipc';
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard';
import type { IProfessorPaymentData } from '@/types/payment';

interface Teaching { class?: { name: string }; course?: { name: string } }
interface Professor { id: number; firstname: string; lastname: string; subject?: string; teaching?: Teaching[]; qualification?: { name: string } }
interface Payment extends Omit<IProfessorPaymentData, 'professorId'> {
  id: number; createdAt: string; professor: Professor;
  grossAmount: number; netAmount: number;
  hoursTotal?: number; hourlyRate?: number;
  reference?: string; month: string;
  deductions?: Array<{ name: string; amount: number; description?: string }>;
  additions?: Array<{ name: string; amount: number; description?: string }>;
}
interface Filters { professorName: string; month?: string; paymentStatus?: 'paid' | 'pending' }

const route = useRoute();
const router = useRouter();
const accStore = useAccountingStore();
const { currency, formatMoney, amountInWords } = useCurrency();

type TabName = 'heures' | 'paiements' | 'bulletins';
const activeTab = ref<TabName>((String(route.query.tab ?? 'heures') as TabName) || 'heures');
if (!['heures', 'paiements', 'bulletins'].includes(activeTab.value)) activeTab.value = 'heures';

// ---------- Stats + Paiements (onglet 2, existant) ----------
const loading = ref(false);
const totalProfessors = ref(0);
const totalPaid = ref(0);
const payments = ref<Payment[]>([]);
const filteredPayments = ref<Payment[]>([]);
const paymentDialogVisible = ref(false);
const selectedProfessor = ref<Professor | undefined>(undefined);
const selectedPayment = ref<Payment | undefined>(undefined);
const filters = ref<Filters>({ professorName: '', month: undefined, paymentStatus: undefined });

// ---------- Heures (onglet 1, repris de TeacherPayView) ----------
const now = new Date();
const mois = ref(String(now.getMonth() + 1).padStart(2, '0'));
const annee = ref(now.getFullYear());
const moisOptions = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
];
const anneeOptions = computed(() => { const y = now.getFullYear(); return [y - 2, y - 1, y, y + 1]; });
const hoursLoading = ref(false);
const hoursError = ref<string | null>(null);
const payingAll = ref(false);
const hourSaving = ref(false);
const selectedHourIds = ref<number[]>([]);
const currentHour = ref<TeacherHourRow | null>(null);
const hourDetail = ref({ heures: 0, tarif: 0, prime: 0, transport: 0, avance: 0, retenue: 0, mode: 'cash', telephone: '', observation: '' });
const heureSousTotal = computed(() => Number(hourDetail.value.heures ?? 0) * Number(hourDetail.value.tarif ?? 0));
const heureMontantAPayer = computed(() => Math.max(0, heureSousTotal.value + Number(hourDetail.value.prime ?? 0) + Number(hourDetail.value.transport ?? 0) - Number(hourDetail.value.avance ?? 0) - Number(hourDetail.value.retenue ?? 0)));
const hourPrefill = computed(() => currentHour.value ? {
  heures: hourDetail.value.heures, tarif: hourDetail.value.tarif, prime: hourDetail.value.prime,
  transport: hourDetail.value.transport, avance: hourDetail.value.avance,
  professorId: currentHour.value.teacherId ?? currentHour.value.id,
  firstname: currentHour.value.firstname, lastname: currentHour.value.lastname,
} : undefined);

// ---------- Bulletins (onglet 3) ----------
const bulletin = ref<Payment | null>(null);
const schoolName = ref('');
const schoolAddress = ref('');
const schoolPhone = ref('');
const schoolEmail = ref('');
const schoolYear = ref('');
const bulletinPhone = ref('');

function formatDateJJMMAAAA(d: unknown): string {
  if (!d) return '—';
  try {
    const dt = d instanceof Date ? d : new Date(String(d));
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}
function formatPeriode(month: string): string {
  if (!month) return '—';
  try {
    const dt = new Date(`${month}-01`);
    if (Number.isNaN(dt.getTime())) return month;
    return dt.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch { return month; }
}
function uuidv4(): string {
  const c = window.crypto as unknown as { randomUUID?: () => string };
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const bulletinDeductions = computed(() => (bulletin.value?.deductions ?? []).map((d) => ({ label: d.name, montant: Number(d.amount ?? 0) })));
const bulletinHours = computed(() => Number(bulletin.value?.hoursTotal ?? 0));
const bulletinRate = computed(() => Number(bulletin.value?.hourlyRate ?? 0));
const bulletinSousTotal = computed(() => bulletinHours.value * bulletinRate.value || Number(bulletin.value?.grossAmount ?? bulletin.value?.amount ?? 0));
const bulletinPrime = computed(() => findAddition('prime'));
const bulletinTransport = computed(() => findAddition('transport'));
const bulletinAvance = computed(() => findDeduction('avance'));
const bulletinRetenue = computed(() => Math.max(0, (bulletin.value?.deductions ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0) - bulletinAvance.value));
const bulletinBrut = computed(() => Number(bulletin.value?.grossAmount ?? bulletinSousTotal.value + bulletinPrime.value + bulletinTransport.value));
function findAddition(key: string): number {
  const adds = bulletin.value?.additions ?? [];
  const hit = adds.find((a) => String(a.name ?? '').toLowerCase().includes(key));
  return Number(hit?.amount ?? 0);
}
function findDeduction(key: string): number {
  const ds = bulletin.value?.deductions ?? [];
  const hit = ds.find((d) => String(d.name ?? '').toLowerCase().includes(key));
  return Number(hit?.amount ?? 0);
}

// ---------- Formatage paiements ----------
const getPaymentTypeColor = (type: string): string => {
  const colors: Record<string, string> = { salary: 'primary', salaire: 'primary', bonus: 'success', prime: 'success', overtime: 'warning' };
  return colors[type] || 'info';
};
const formatPaymentType = (type: string): string => {
  const types: Record<string, string> = { salary: 'Salaire', salaire: 'Salaire', bonus: 'Prime', prime: 'Prime', overtime: 'Heures sup.' };
  return types[type] || type;
};
const formatPaymentMethod = (method: string): string => {
  const methods: Record<string, string> = {
    cash: 'Espèces', especes: 'Espèces', check: 'Chèque', transfer: 'Virement',
    mobile_money: 'Orange Money', orange_money: 'Orange Money', mtn_money: 'MTN Mobile Money', mtn: 'MTN Mobile Money',
  };
  return methods[method] || method;
};
const getInitials = (p: Professor): string => `${p.firstname?.[0] ?? ''}${p.lastname?.[0] ?? ''}`.toUpperCase();
const getTeachingInfo = (p: Professor): string => {
  if (p.subject) return p.subject;
  if (p.teaching?.length) { const t = p.teaching[0]; return t.class?.name || t.course?.name || 'N/A'; }
  return 'N/A';
};

// ---------- Chargements ----------
async function loadSchool(): Promise<void> {
  try {
    const s = await strictInvoke<Record<string, unknown>>('school:get', {});
    const d = (s ?? {}) as Record<string, unknown>;
    schoolName.value = String((d.name as string) ?? '');
    schoolAddress.value = String((d.address as string) ?? '');
    schoolPhone.value = String((d.phone as string) ?? '');
    schoolEmail.value = String((d.email as string) ?? '');
    const yearRep = await strictInvoke<{ schoolYear?: string }>('school:year:current', {}).catch(() => null);
    schoolYear.value = String((yearRep as { schoolYear?: string } | null)?.schoolYear ?? (d.schoolYear as string) ?? `${now.getFullYear()}-${now.getFullYear() + 1}`);
  } catch { /* en-tête bulletin vide = état explicite, zéro mock */ }
}
async function loadStats(): Promise<void> {
  try {
    // Lectures seules : strictInvoke (jamais de window.ipcRenderer direct).
    const r = await strictInvoke<{ nbr_child?: number }>('professor:count').catch(() => null);
    if (r) totalProfessors.value = Number(r.nbr_child) || 0;
    const s = await strictInvoke<{ totalPaid?: number }>('professor:payments:stats').catch(() => null);
    if (s) totalPaid.value = Number(s.totalPaid) || 0;
  } catch (e) { console.error(e); }
}
async function loadPayments(): Promise<void> {
  loading.value = true;
  try {
    await loadStats();
    const data = await strictInvoke<Payment[]>('professor:payments:list', { month: filters.value.month, status: filters.value.paymentStatus });
    payments.value = Array.isArray(data) ? data : [];
    handleFilter();
    applyIdFromQuery();
  } catch (e) { console.error(e); ElMessage.error('Erreur lors du chargement des données'); }
  finally { loading.value = false; }
}
function handleFilter(): void {
  filteredPayments.value = payments.value.filter((p) => {
    const q = filters.value.professorName.toLowerCase().trim();
    const nameMatch = q ? (() => {
      const f = p.professor.firstname.toLowerCase(); const l = p.professor.lastname.toLowerCase();
      return `${f} ${l}`.includes(q) || `${l} ${f}`.includes(q) || f.includes(q) || l.includes(q);
    })() : true;
    const monthMatch = filters.value.month ? p.month === filters.value.month : true;
    const statusMatch = filters.value.paymentStatus ? ((p.isPaid ? 'paid' : 'pending') === filters.value.paymentStatus) : true;
    return nameMatch && monthMatch && statusMatch;
  });
}
async function chargerHeures(): Promise<void> {
  hoursLoading.value = true; hoursError.value = null; currentHour.value = null;
  try {
    await accStore.fetchTeacherHours(`${annee.value}-${mois.value}`, annee.value);
    if (!accStore.teacherHours.length) return;
    await loadSchool();
  } catch (err) { hoursError.value = err instanceof Error ? err.message : 'Chargement heures impossible (zéro mock)'; }
  finally { hoursLoading.value = false; }
}
function selectHourRow(row: TeacherHourRow): void {
  // Garde d'OUVERTURE : popup AVANT d'afficher le panneau de détail.
  void (async () => {
    try {
      await openGuardedForm(() => {
        currentHour.value = row;
        hourDetail.value = {
          heures: Number(row.heures ?? 0), tarif: Number(row.tarifHoraire ?? 0),
          prime: Number(row.prime ?? 0), transport: Number(row.transport ?? 0),
          avance: Number(row.avance ?? 0), retenue: Number(row.retenue ?? 0),
          mode: String(row.mode ?? 'cash'), telephone: String(row.phone ?? ''), observation: String(row.observation ?? ''),
        };
      });
    } catch (err) { handleGuardError(err); }
  })();
}
function goSlip(row: TeacherHourRow): void {
  void router.push({ path: '/payment/professors', query: { ...route.query, tab: 'bulletins', id: String(row.id) } });
  activeTab.value = 'bulletins';
}
function handleGuardError(err: unknown): void {
  if (isNoSecretError(err)) { ElMessage.warning(mapAccountingError(err)); void router.push('/comptabilite/setup'); }
}
async function validateRow(row: TeacherHourRow): Promise<void> {
  // Garde d'OUVERTURE AVANT validation (double garde store au submit conservée).
  let opened = false;
  try { opened = await openGuardedForm(async () => undefined); }
  catch (err) { handleGuardError(err); return; }
  if (!opened) return;
  try { await accStore.validateTeacher(row.id); ElMessage.success('Ligne validée'); }
  catch (err) { handleGuardError(err); }
}
async function payRow(row: TeacherHourRow): Promise<void> {
  // Garde d'OUVERTURE AVANT paiement (double garde store au submit conservée).
  let opened = false;
  try { opened = await openGuardedForm(async () => undefined); }
  catch (err) { handleGuardError(err); return; }
  if (!opened) return;
  try { await accStore.payTeacher(row.id, { month: `${annee.value}-${mois.value}`, idempotencyKey: uuidv4() }); ElMessage.success('Paiement enregistré'); }
  catch (err) { handleGuardError(err); }
}
async function validerEtPayer(): Promise<void> {
  if (!selectedHourIds.value.length || payingAll.value) return;
  // Garde d'OUVERTURE AVANT paiement groupé (double garde store conservée).
  let opened = false;
  try { opened = await openGuardedForm(async () => undefined); }
  catch (err) { handleGuardError(err); return; }
  if (!opened) return;
  payingAll.value = true;
  try {
    const month = `${annee.value}-${mois.value}`;
    const batchKey = uuidv4();
    const idempotencyKeys: Record<number, string> = Object.fromEntries(selectedHourIds.value.map((id) => [id, `${batchKey}-${id}-${month}`]));
    await accStore.payTeacherBatch(selectedHourIds.value, { month, batchKey, idempotencyKeys });
    ElMessage.success(`${selectedHourIds.value.length} enseignant(s) payé(s)`);
    selectedHourIds.value = [];
    await chargerHeures(); await loadPayments();
  } catch (err) { handleGuardError(err); }
  finally { payingAll.value = false; }
}
async function enregistrerHeure(): Promise<void> {
  if (!currentHour.value || hourSaving.value) return;
  // Garde d'OUVERTURE AVANT enregistrement (double garde store conservée).
  let opened = false;
  try { opened = await openGuardedForm(async () => undefined); }
  catch (err) { handleGuardError(err); return; }
  if (!opened) return;
  hourSaving.value = true;
  try {
    await accStore.payTeacher(currentHour.value.id, {
      month: `${annee.value}-${mois.value}`, heures: hourDetail.value.heures, tarifHoraire: hourDetail.value.tarif,
      prime: hourDetail.value.prime, transport: hourDetail.value.transport, avance: hourDetail.value.avance,
      retenue: hourDetail.value.retenue, mode: hourDetail.value.mode, telephone: hourDetail.value.telephone,
      observation: hourDetail.value.observation, montant: heureMontantAPayer.value, idempotencyKey: uuidv4(),
    });
    ElMessage.success('Paie enregistrée'); await loadPayments();
  } catch (err) { handleGuardError(err); }
  finally { hourSaving.value = false; }
}
function ouvrirDialogDepuisHeure(): void {
  if (!currentHour.value) return;
  // Garde d'OUVERTURE : popup AVANT l'ouverture du dialogue de paiement.
  void (async () => {
    try {
      await openGuardedForm(() => {
        selectedPayment.value = undefined;
        selectedProfessor.value = { id: currentHour.value!.teacherId ?? currentHour.value!.id, firstname: currentHour.value!.firstname, lastname: currentHour.value!.lastname, subject: currentHour.value!.matiere };
        paymentDialogVisible.value = true;
      });
    } catch (err) { handleGuardError(err); }
  })();
}

// ---------- Paiements actions ----------
function showNewPaymentDialog(): void {
  // Garde d'OUVERTURE « Nouveau paiement » : popup AVANT l'ouverture du dialogue.
  void (async () => {
    try {
      await openGuardedForm(() => { selectedPayment.value = undefined; selectedProfessor.value = undefined; paymentDialogVisible.value = true; });
    } catch (err) { handleGuardError(err); }
  })();
}
function editPayment(p: Payment): void {
  // Garde d'OUVERTURE « Modifier paiement » : popup AVANT l'ouverture du dialogue.
  void (async () => {
    try {
      await openGuardedForm(() => { selectedPayment.value = p; selectedProfessor.value = p.professor; paymentDialogVisible.value = true; });
    } catch (err) { handleGuardError(err); }
  })();
}
function handlePaymentAdded(): void { paymentDialogVisible.value = false; void loadPayments(); }
function refreshData(): void { void loadPayments(); void chargerHeures(); }
function exportToExcel(): void {
  try {
    loading.value = true;
    const rows = filteredPayments.value.map((p) => ({
      'Professeur': `${p.professor.firstname} ${p.professor.lastname}`,
      'Matière': p.professor.subject || 'N/A',
      'Référence': p.reference || `PAY-ENS-${p.id}`,
      'Type': formatPaymentType(p.type),
      'Montant': p.amount,
      'Devise': currency.value,
      'Mode': formatPaymentMethod(p.paymentMethod),
      'Mois': formatPeriode(p.month),
      'Date': formatDateJJMMAAAA(p.createdAt),
      'Statut': p.isPaid ? 'Payé' : 'En attente',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Paiements');
    XLSX.writeFile(wb, `paiements_professeurs_${new Date().toISOString().split('T')[0]}.xlsx`);
    ElMessage.success('Export Excel réussi');
  } catch (e) { console.error(e); ElMessage.error("Erreur lors de l'export Excel"); }
  finally { loading.value = false; }
}

// ---------- Bulletins ----------
function selectBulletin(row: Payment): void {
  bulletin.value = row;
  bulletinPhone.value = '';
  void router.push({ path: '/payment/professors', query: { ...route.query, tab: 'bulletins', id: String(row.id) } });
}
function goBulletin(row: Payment): void { activeTab.value = 'bulletins'; selectBulletin(row); }
function applyIdFromQuery(): void {
  const id = String(route.query.id ?? '');
  if (route.query.tab === 'bulletins' && id) {
    const hit = payments.value.find((p) => String(p.id) === id || String(p.reference ?? '') === id);
    if (hit) bulletin.value = hit;
  }
}
function printBulletin(): void {
  if (!bulletin.value) return;
  try {
    const el = document.querySelector('#bulletin-print-zone');
    printJS({ printable: 'bulletin-print-zone', type: 'html', documentTitle: `Bulletin ${bulletin.value.reference || `PAY-ENS-${bulletin.value.id}`}`, targetStyles: ['*'] });
    void el;
  } catch { window.print(); }
}
function exportBulletinPdf(): void {
  if (!bulletin.value) { ElMessage.warning('Aucun bulletin sélectionné'); return; }
  const ref = bulletin.value.reference || `PAY-ENS-${bulletin.value.id}`;
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold'); doc.text(String(schoolName.value || 'Bulletin de paie'), 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${ref} — Période : ${formatPeriode(bulletin.value.month)}`, 14, 28);
  doc.text(`Enseignant : ${bulletin.value.professor.firstname} ${bulletin.value.professor.lastname}`, 14, 36);
  doc.text(`Brut : ${formatMoney(bulletinBrut.value)}`, 14, 44);
  doc.text(`Net : ${formatMoney(Number(bulletin.value.netAmount ?? bulletin.value.amount ?? 0))}`, 14, 52);
  doc.text(`En lettres : ${amountInWords(Number(bulletin.value.netAmount ?? bulletin.value.amount ?? 0))}`, 14, 60, { maxWidth: 180 });
  doc.text(`Date : ${formatDateJJMMAAAA(bulletin.value.createdAt)} — Mode : ${formatPaymentMethod(bulletin.value.paymentMethod)}`, 14, 76);
  doc.save(`bulletin_${ref}.pdf`);
  ElMessage.success('Bulletin exporté en PDF');
}
function onTabChange(tab: string | number): void {
  const t = String(tab) as TabName;
  void router.push({ path: '/payment/professors', query: { ...route.query, tab: t } });
}
watch(() => route.query.tab, (t) => {
  const v = String(t ?? 'heures') as TabName;
  if (['heures', 'paiements', 'bulletins'].includes(v)) activeTab.value = v;
});
watch(() => route.query.id, () => applyIdFromQuery());

onMounted(async () => { await loadSchool(); await loadPayments(); await chargerHeures(); applyIdFromQuery(); });
</script>

<style scoped>
.professor-payment { height: 100vh; display: flex; flex-direction: column; }
.payment-header { padding: 10px 20px; height: auto; max-height: 120px; }
.stat-card { transition: transform 0.3s ease; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); margin-bottom: 5px; }
.compact-stat-content { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; }
.stat-info { display: flex; align-items: center; gap: 8px; }
.stat-label { font-size: 14px; font-weight: 500; color: var(--el-text-color-regular); }
.stat-value, .stat-amount { font-size: 18px; font-weight: 600; color: var(--el-text-color-primary); }
.payment-content { flex: 1; overflow: auto; padding: 0 20px 20px; }
.pay-head { margin-bottom: 10px; }
.pay-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pay-card { border-radius: 8px; margin-bottom: 12px; }
.pay-panel { border: 1px solid var(--el-color-primary); }
.pay-select { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.pay-words { font-size: 13px; color: var(--el-text-color-secondary); }
.pay-form { margin-top: 4px; }
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; }
.search-filters { display: flex; gap: 10px; flex: 1; flex-wrap: wrap; align-items: center; }
.search-input { min-width: 200px; max-width: 300px; }
.filter-date { width: 180px; }
.professor-info { display: flex; align-items: center; gap: 10px; }
.professor-details { display: flex; flex-direction: column; }
.professor-details small { color: var(--el-text-color-secondary); }
.bulletin-layout { display: grid; grid-template-columns: minmax(320px, 420px) 1fr; gap: 12px; align-items: start; }
.bulletin-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.bulletin-actions { display: flex; gap: 6px; }
@media (max-width: 1024px) { .bulletin-layout { grid-template-columns: 1fr; } }
@media print { .el-button, .el-dialog__wrapper { display: none !important; } }
</style>
