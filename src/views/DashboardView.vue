<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { Chart, registerables } from 'chart.js';
import { useCurrency } from '@/composables/useCurrency';
import { useRouter } from 'vue-router';

const router = useRouter();

Chart.register(...registerables);

// --- Interfaces ---

interface DashboardStats {
  school: {
    name: string;
    logo?: string;
    address: string;
    phone: string;
  };
  stats: {
    totalStudents: number;
    totalProfessors: number;
    totalClasses: number;
    recentPayments: Array<any>;
    recentAbsences: Array<any>;
  };
}

// --- State ---
const stats = ref<DashboardStats | null>(null);
const loading = ref(true);
const paymentChartRef = ref<HTMLCanvasElement | null>(null);
const absenceChartRef = ref<HTMLCanvasElement | null>(null);
const { currency } = useCurrency();
const schoolLogo = ref<string | null>(null);
const dashboardProfessors = ref<any[]>([]);

// --- Computed ---
const recentAbsencesDisplay = computed(() => {
  const absences = stats.value?.stats?.recentAbsences;
  return Array.isArray(absences) ? absences.slice(0, 5) : [];
});

const currentDate = computed(() => {
    return new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});

// --- Chart Configuration Helper ---
// Fonction pour créer un dégradé joli pour le graphique
const createGradient = (ctx: CanvasRenderingContext2D, colorStart: string, colorEnd: string) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
};

// Helper couleurs profs distinctes (même palette que planning)
const dashboardPalette = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#14B8A6', '#A855F7', '#F97316', '#06B6D4'];
const getDashboardProfColor = (label: string, index: number): string => {
  const prof = dashboardProfessors.value.find((p:any) => `${p.firstname} ${p.lastname}`.trim() === label);
  if (prof?.color) {
    // Si plusieurs profs ont même couleur par défaut, assurer distinct via palette
    const sameColorCount = dashboardProfessors.value.filter((pp:any) => pp.color === prof.color).length;
    if (prof.color !== '#409EFF' || sameColorCount === 1) return prof.color;
  }
  if (prof) {
    // Fallback distinct par id
    return dashboardPalette[(prof.id as number) % dashboardPalette.length];
  }
  return dashboardPalette[index % dashboardPalette.length];
};

//--- Navigation ---
const navigateToAbsences = () => {
  router.push('/planning/students/absences');
};

const navigateToPayments = () => {
  router.push('/payment/students');
};

// --- Logic ---
const loadDashboardStats = async () => {
  try {
    const results = await Promise.allSettled([
      window.ipcRenderer.invoke('dashboard:stats'),
      window.ipcRenderer.invoke('school:get'),
      window.ipcRenderer.invoke('dashboard:paymentStats'),
      window.ipcRenderer.invoke('dashboard:absenceStats'),
      window.ipcRenderer.invoke('professor:all')
    ]);

    const [statsResult, schoolResult, paymentStats, absenceStats, profResult] = results.map((r: any) =>
      r.status === 'fulfilled' ? r.value : { success: false, data: null, error: r.reason }
    ) as any[];

    // professor:all is optional — fallback palette ensures dashboard still renders
    if (profResult?.success && Array.isArray(profResult.data)) {
      dashboardProfessors.value = profResult.data;
    } else {
      dashboardProfessors.value = [];
      if (profResult && !profResult.success) {
        console.warn('[Dashboard] professor:all failed, using fallback palette', profResult?.error ?? profResult);
      }
    }

    // Core stats: set even if other requests failed — do not swallow partial data
    if (statsResult?.success && statsResult.data) {
      stats.value = {
        school: schoolResult?.success ? schoolResult.data : (statsResult.data.school || {}),
        stats: {
          totalStudents: Number(statsResult.data.stats?.totalStudents) || 0,
          totalProfessors: Number(statsResult.data.stats?.totalProfessors) || 0,
          totalClasses: Number(statsResult.data.stats?.totalClasses) || 0,
          recentPayments: statsResult.data.stats?.recentPayments || [],
          recentAbsences: statsResult.data.stats?.recentAbsences || []
        }
      };
    } else if (!statsResult?.success) {
      console.warn('[Dashboard] dashboard:stats failed', (statsResult as any)?.error ?? statsResult);
    }

    if (schoolResult && !schoolResult?.success) {
      console.warn('[Dashboard] school:get failed, falling back to stats.school', (schoolResult as any)?.error ?? schoolResult);
    }

    // Fetch school logo — isolated so failure does not break dashboard
    if (schoolResult?.success && schoolResult.data?.logo?.id) {
      try {
        const logoResult = await window.ipcRenderer.invoke('school:getLogo', schoolResult.data.logo.id);
        if (logoResult?.success && logoResult.data) {
          schoolLogo.value = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
        } else if (logoResult && !logoResult.success) {
          console.warn('[Dashboard] school:getLogo failed', (logoResult as any)?.error ?? logoResult);
        }
      } catch (e) {
        console.warn('[Dashboard] school:getLogo threw', e);
      }
    }

    // Graphique Paiements - tolerant to null/undefined, isolated error handling
    try {
      const paymentData = (paymentStats as any)?.data ?? {};
      const isPaymentOk = paymentStats?.success;
      if (!isPaymentOk) {
        console.warn('[Dashboard] dashboard:paymentStats failed or empty, rendering fallback', (paymentStats as any)?.error ?? paymentStats);
      }
      if (paymentChartRef.value) {
        // Render chart even on fallback data; tolerant to null/undefined via || {}
        const ctx = paymentChartRef.value.getContext('2d');
        const gradient = ctx ? createGradient(ctx, 'rgba(64, 158, 255, 0.5)', 'rgba(64, 158, 255, 0.0)') : '#409EFF';
        const rawData = isPaymentOk ? paymentData : {};
        const labels = Object.keys(rawData || {});
        const values = Object.values(rawData || {}) as number[];
        // Fallback si aucune donnée: afficher mois courant à 0 pour éviter chart vide
        const chartLabels = labels.length ? labels : [new Date().toLocaleString('fr-FR', { month: 'long' })];
        const chartData = values.length ? values : [0];

        new Chart(paymentChartRef.value, {
          type: 'line',
          data: {
            labels: chartLabels,
            datasets: [{
              label: 'Revenus',
              data: chartData,
              borderColor: '#409EFF',
              backgroundColor: gradient,
              borderWidth: 3,
              pointBackgroundColor: '#fff',
              pointBorderColor: '#409EFF',
              pointBorderWidth: 2,
              pointRadius: 4,
              fill: true,
              tension: 0.4 // Courbes douces
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#2c3e50',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 14, weight: 'bold' },
                callbacks: {
                  label: function(context) {
                    return `Total: ${new Intl.NumberFormat('fr-FR').format(context.raw as number)} ${currency.value}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: ({ color: '#f0f0f0', borderDash: [5, 5] } as any),
                ticks: { font: { size: 11 }, color: '#909399' }
              },
              x: {
                grid: { display: false },
                ticks: { font: { size: 11 }, color: '#909399' }
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Dashboard] payment chart render failed, stats still displayed', e);
    }

    // Graphique Absences - par prof distinct avec sa couleur, tolerant to null/undefined
    try {
      const absenceData = (absenceStats as any)?.data ?? {};
      const isAbsenceOk = absenceStats?.success;
      if (!isAbsenceOk) {
        console.warn('[Dashboard] dashboard:absenceStats failed or empty, rendering fallback', (absenceStats as any)?.error ?? absenceStats);
      }
      if (absenceChartRef.value) {
        const rawData = isAbsenceOk ? absenceData : {};
        const labels = Object.keys(rawData || {});
        const values = Object.values(rawData || {}) as number[];
        const chartLabels = labels.length ? labels : ['Aucune absence'];
        const chartData = values.length ? values : [1];
        // Couleurs : si label = nom prof, utiliser couleur du prof, sinon palette (fallback when profResult failed)
        const bgColors = labels.length ? chartLabels.map((label, idx) => getDashboardProfColor(label, idx)) : ['#ebeef5'];
        new Chart(absenceChartRef.value, {
          type: 'doughnut',
          data: {
            labels: chartLabels,
            datasets: [{
              data: chartData,
              backgroundColor: bgColors.slice(0, chartLabels.length),
              borderWidth: 0,
              hoverOffset: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                  position: 'right',
                  labels: { usePointStyle: true, font: { size: 12 } }
              },
              tooltip: {
                enabled: labels.length > 0
              }
            },
            cutout: '75%' // Anneau plus fin et élégant
          }
        });
      }
    } catch (e) {
      console.warn('[Dashboard] absence chart render failed, stats still displayed', e);
    }

    // If core stats still missing after partial successes, notify once
    if (!stats.value) {
      ElMessage.warning('Statistiques principales indisponibles, affichage partiel');
    }
  } catch (error) {
    console.error('[Dashboard] loadDashboardStats unexpected error', error);
    // Do not swallow partial data: only show fatal error if stats still null
    if (!stats.value) {
      ElMessage.error('Impossible de charger les statistiques');
    } else {
      console.warn('[Dashboard] partial data kept despite error, stats still displayed');
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDashboardStats();
});
</script>

<template>
  <el-scrollbar height="100vh" wrap-class="dashboard-scroll">
    <div class="dashboard-container">
        
      <!-- Header Section -->
      <div class="dashboard-header">
        <div class="header-text">
            <h1 v-if="stats?.school?.name">{{ stats.school.name }}</h1>
            <h1 v-else>Tableau de bord</h1>
            <p class="date-display">
                <Icon icon="mdi:calendar-blank-outline" class="mr-2"/> {{ currentDate }}
            </p>
        </div>
        <div class="school-logo" v-if="schoolLogo">
            <img :src="schoolLogo" alt="Logo école" class="dashboard-logo" />
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="stats-grid">
        <div class="kpi-card">
          <div class="kpi-icon-wrapper blue">
            <Icon icon="mdi:account-school" />
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Élèves Inscrits</span>
            <div class="kpi-value">{{ stats?.stats.totalStudents || 0 }}</div>
          </div>
          <!-- Petit indicateur visuel purement esthétique -->
          <div class="kpi-trend positive">
            <Icon icon="mdi:trending-up" /> Actifs
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrapper green">
            <Icon icon="mdi:teach" />
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Professeurs</span>
            <div class="kpi-value">{{ stats?.stats.totalProfessors || 0 }}</div>
          </div>
           <div class="kpi-trend neutral">
            <Icon icon="mdi:account-check" /> Présents
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-wrapper orange">
            <Icon icon="mdi:google-classroom" />
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Classes Ouvertes</span>
            <div class="kpi-value">{{ stats?.stats.totalClasses || 0 }}</div>
          </div>
          <div class="kpi-trend neutral">
             <Icon icon="mdi:door-open" /> Total
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <el-row :gutter="24" class="charts-row">
        <el-col :xs="24" :lg="16" class="mb-4">
          <div class="custom-card chart-card">
            <div class="card-header-clean">
              <h3><Icon icon="mdi:chart-timeline-variant" class="icon-header"/> Évolution financière</h3>
              <el-tag size="small" effect="plain">Cette année</el-tag>
            </div>
            <div class="chart-wrapper">
              <canvas ref="paymentChartRef"></canvas>
            </div>
          </div>
        </el-col>
        
        <el-col :xs="24" :lg="8" class="mb-4">
          <div class="custom-card chart-card">
            <div class="card-header-clean">
              <h3><Icon icon="mdi:chart-donut" class="icon-header"/> Répartition Absences</h3>
            </div>
            <div class="chart-wrapper doughnut-wrapper">
              <canvas ref="absenceChartRef"></canvas>
            </div>
             <div class="chart-footer-text">
                Par niveau scolaire
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- Recent Activities Row -->
      <el-row :gutter="24">
        <el-col :xs="24" :md="12" class="mb-4">
          <div class="custom-card">
            <div class="card-header-clean">
              <h3><Icon icon="mdi:wallet-outline" class="icon-header"/> Derniers paiements</h3>
              <el-button link type="primary" @click="navigateToPayments">Voir tout</el-button>
            </div>
            <div class="list-container">
              <div
                class="list-item"
                v-for="(payment, index) in stats?.stats.recentPayments.slice(0, 5)"
                :key="index"
              >
                <div class="item-icon-circle bg-blue-light">
                    <Icon icon="mdi:cash-multiple" />
                </div>
                <div class="item-details">
                  <span class="item-title">{{ payment.studentName }}</span>
                  <span class="item-sub">{{ new Date(payment.date).toLocaleDateString() }}</span>
                </div>
                <div class="item-amount positive">
                   +{{ new Intl.NumberFormat('fr-FR').format(payment.amount) }} {{ currency }}
                </div>
              </div>
               <div v-if="!stats?.stats.recentPayments.length" class="empty-state">
                  Aucun paiement récent
              </div>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :md="12" class="mb-4">
          <div class="custom-card">
            <div class="card-header-clean">
              <h3><Icon icon="mdi:alert-circle-outline" class="icon-header text-red"/> Absences récentes</h3>
              <el-button link type="danger" @click="navigateToAbsences">Voir tout</el-button>
            </div>
            <div class="list-container">
              <div
                class="list-item"
                v-for="(absence, index) in recentAbsencesDisplay"
                :key="index"
              >
                 <div class="item-icon-circle" :class="(absence as any).type === 'PROFESSOR' ? 'bg-blue-light' : 'bg-red-light'">
                    <Icon :icon="(absence as any).type === 'PROFESSOR' ? 'mdi:teach' : 'mdi:school-outline'" />
                </div>
                <div class="item-details">
                  <span class="item-title">{{ absence.studentName }} <el-tag v-if="(absence as any).type === 'PROFESSOR'" size="small" type="info" class="ml-2">Prof</el-tag></span>
                  <span class="item-sub">Classe : {{ absence.className }}</span>
                </div>
                <div class="item-date">
                  {{ new Date(absence.date).toLocaleDateString() }}
                </div>
              </div>
              <div v-if="!recentAbsencesDisplay.length" class="empty-state">
                  Aucune absence récente
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

    </div>
  </el-scrollbar>
</template>

<style scoped>
/* Layout Global */
.dashboard-container {
  padding: 30px;
  background-color: #f5f7fa; /* Gris très léger premium */
  min-height: 100vh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.mb-4 { margin-bottom: 24px; }
.mr-2 { margin-right: 8px; }
.text-red { color: #F56C6C; }

/* Header */
.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
}

.dashboard-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #2c3e50;
    margin: 0 0 8px 0;
}

.date-display {
    color: #606266;
    font-size: 14px;
    display: flex;
    align-items: center;
    text-transform: capitalize;
}

/* KPI Cards (Stats Grid) */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.kpi-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  position: relative;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.06);
}

.kpi-icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-right: 20px;
}

.kpi-icon-wrapper.blue { background: rgba(64, 158, 255, 0.1); color: #409EFF; }
.kpi-icon-wrapper.green { background: rgba(103, 194, 58, 0.1); color: #67C23A; }
.kpi-icon-wrapper.orange { background: rgba(230, 162, 60, 0.1); color: #E6A23C; }

.kpi-content {
  flex: 1;
}

.kpi-label {
  display: block;
  color: #909399;
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #2c3e50;
  line-height: 1.2;
}

.kpi-trend {
    position: absolute;
    top: 24px;
    right: 24px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
}
.kpi-trend.positive { color: #67C23A; }
.kpi-trend.neutral { color: #909399; }

.school-logo {
  display: flex;
  align-items: center;
}
.dashboard-logo {
  max-height: 70px;
  max-width: 70px;
  border-radius: 12px;
  object-fit: contain;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* Custom Cards (Charts & Lists) */
.custom-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.03);
    border: 1px solid rgba(0,0,0,0.03);
    height: 100%;
    display: flex;
    flex-direction: column;
}

.card-header-clean {
    padding: 20px 24px;
    border-bottom: 1px solid #f5f7fa;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.card-header-clean h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 10px;
}

.icon-header {
    font-size: 20px;
    color: #909399;
}

.chart-wrapper {
    padding: 20px;
    position: relative;
    height: 300px;
    width: 100%;
}

.chart-footer-text {
    text-align: center;
    color: #909399;
    font-size: 12px;
    padding-bottom: 20px;
}

/* List Styles */
.list-container {
    padding: 10px 24px 24px;
}

.list-item {
    display: flex;
    align-items: center;
    padding: 16px 0;
    border-bottom: 1px solid #f5f7fa;
    transition: background-color 0.2s;
}

.list-item:last-child {
    border-bottom: none;
}

.item-icon-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    margin-right: 16px;
}

.bg-blue-light { background: #ecf5ff; color: #409EFF; }
.bg-red-light { background: #fef0f0; color: #F56C6C; }

.item-details {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.item-title {
    font-weight: 600;
    font-size: 14px;
    color: #2c3e50;
}

.item-sub {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
}

.item-amount {
    font-weight: 600;
    font-size: 14px;
}

.item-amount.positive { color: #67C23A; }

.item-date {
    font-size: 13px;
    color: #909399;
}

.empty-state {
    padding: 20px;
    text-align: center;
    color: #909399;
    font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
    .dashboard-container {
        padding: 16px;
    }
    
    .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }
    
    .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .chart-wrapper {
        height: 250px;
    }
}
</style>
