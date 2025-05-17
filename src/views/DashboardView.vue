<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { Chart, registerables } from 'chart.js';
import { useCurrency } from '@/composables/useCurrency';

Chart.register(...registerables);

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

const stats = ref<DashboardStats | null>(null);
const loading = ref(true);
const paymentChartRef = ref<HTMLCanvasElement | null>(null);
const absenceChartRef = ref<HTMLCanvasElement | null>(null);
const { currency } = useCurrency();

const loadDashboardStats = async () => {
  try {
    const statsResult = await window.ipcRenderer.invoke('dashboard:stats');
    console.log('Résultat stats:', statsResult);
    
    if (statsResult?.success && statsResult.data) {
      console.log('Stats data structure:', JSON.stringify(statsResult.data));
      stats.value = {
        school: statsResult.data.school || {},
        stats: {
          totalStudents: Number(statsResult.data.stats.totalStudents) || 0,
          totalProfessors: Number(statsResult.data.stats.totalProfessors) || 0,
          totalClasses: Number(statsResult.data.stats.totalClasses) || 0,
          recentPayments: statsResult.data.stats.recentPayments || [],
          recentAbsences: statsResult.data.stats.recentAbsences || []
        }
      };
      console.log('Stats après traitement:', stats.value);
    }

    const [paymentStats, absenceStats] = await Promise.all([
      window.ipcRenderer.invoke('dashboard:paymentStats'),
      window.ipcRenderer.invoke('dashboard:absenceStats')
    ]);
    
    console.log('Résultat paymentStats:', paymentStats);
    console.log('Résultat absenceStats:', absenceStats);

    if (paymentStats.success && paymentChartRef.value) {
      console.log('Construction du graphique de paiement avec:', paymentStats.data);
      new Chart(paymentChartRef.value, {
        type: 'line',
        data: {
          labels: Object.keys(paymentStats.data),
          datasets: [{
            label: 'Paiements mensuels ' + currency.value,
            data: Object.values(paymentStats.data),
            borderColor: '#409EFF',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${new Intl.NumberFormat('fr-FR').format(context.raw as number)} ${currency.value}`;
                }
              }
            }
          }
        }
      });
    }

    if (absenceStats.success && absenceChartRef.value) {
      new Chart(absenceChartRef.value, {
        type: 'doughnut',
        data: {
          labels: Object.keys(absenceStats.data),
          datasets: [{
            data: Object.values(absenceStats.data),
            backgroundColor: [
              '#409EFF',
              '#67C23A',
              '#E6A23C',
              '#F56C6C',
              '#909399'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  } catch (error) {
    ElMessage.error('Impossible de charger les statistiques');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadDashboardStats();
});
</script>

<template>
  <div class="dashboard">
    <!-- Cartes de statistiques -->
    <div class="stats-grid">
      <el-card class="stat-card students">
        <div class="stat-icon">
          <Icon icon="mdi:account-school" />
        </div>
        <div class="stat-content">
          <h3>Élèves</h3>
          <div class="stat-value">{{ stats?.stats.totalStudents || 0 }}</div>
          <p>Inscrits</p>
        </div>
      </el-card>

      <el-card class="stat-card teachers">
        <div class="stat-icon">
          <Icon icon="mdi:teach" />
        </div>
        <div class="stat-content">
          <h3>Professeurs</h3>
          <div class="stat-value">{{ stats?.stats.totalProfessors || 0 }}</div>
          <p>Actifs</p>
        </div>
      </el-card>

      <el-card class="stat-card classes">
        <div class="stat-icon">
          <Icon icon="mdi:google-classroom" />
        </div>
        <div class="stat-content">
          <h3>Classes</h3>
          <div class="stat-value">{{ stats?.stats.totalClasses || 0 }}</div>
          <p>Total</p>
        </div>
      </el-card>
    </div>

    <!-- Activités récentes -->

    <!-- Graphiques -->
    <div class="charts-container">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <h3>
                  <Icon icon="mdi:chart-line" />
                  Évolution des paiements
                </h3>
              </div>
            </template>
            <div class="chart-container">
              <canvas ref="paymentChartRef" height="300"></canvas>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card class="chart-card">
            <template #header>
              <div class="card-header">
                <h3>
                  <Icon icon="mdi:chart-pie" />
                  Absences par niveau
                </h3>
              </div>
            </template>
            <div class="chart-container">
              <canvas ref="absenceChartRef" height="300"></canvas>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <!-- Activités récentes -->
<el-row :gutter="20" style="margin-bottom: 32px">
  <el-col :span="12">
    <el-card class="activity-card">
      <template #header>
        <div class="card-header">
          <h3>
            <Icon icon="mdi:cash" />
            Paiements récents
          </h3>
        </div>
      </template>
      <div class="activity-list">
        <div
          class="activity-item"
          v-for="(payment, index) in stats?.stats.recentPayments.slice(0, 5)"
          :key="index"
        >
          <div class="activity-details">
            <strong>{{ payment.studentName }}</strong>
            <span>{{ new Intl.NumberFormat('fr-FR').format(payment.amount) }} {{ currency }}</span>
            <span>{{ new Date(payment.date).toLocaleDateString() }}</span>
          </div>
        </div>
      </div>
    </el-card>
  </el-col>

  <el-col :span="12">
    <el-card class="activity-card">
      <template #header>
        <div class="card-header">
          <h3>
            <Icon icon="mdi:alert-octagon" />
            Absences récentes
          </h3>
        </div>
      </template>
      <div class="activity-list">
        <div
          class="activity-item"
          v-for="(absence, index) in stats?.stats.recentAbsences.slice(0, 5)"
          :key="index"
        >
          <div class="activity-details">
            <strong>{{ absence.studentName }}</strong>
            <span>Classe : {{ absence.className }}</span>
            <span>{{ new Date(absence.date).toLocaleDateString() }}</span>
          </div>
        </div>
      </div>
    </el-card>
  </el-col>
</el-row>

    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 24px;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.school-header {
  background: linear-gradient(135deg, #003366 0%, #004080 100%);
  padding: 32px;
  border-radius: 12px;
  margin-bottom: 32px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  color: white;
}

.school-info {
  display: flex;
  align-items: center;
  gap: 32px;
}

.school-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
  background: white;
  padding: 8px;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.school-details h1 {
  margin: 0 0 12px 0;
  color: white;
  font-size: 32px;
  font-weight: 600;
}

.school-details p {
  margin: 8px 0;
  color: rgba(255,255,255,0.9);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  transition: all 0.3s ease;
  border: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.stat-icon {
  font-size: 48px;
  margin-right: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(64, 158, 255, 0.1);
}

.students .stat-icon {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
}

.teachers .stat-icon {
  color: #67C23A;
  background: rgba(103, 194, 58, 0.1);
}

.classes .stat-icon {
  color: #E6A23C;
  background: rgba(230, 162, 60, 0.1);
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  margin: 0;
  color: #606266;
  font-size: 16px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #303133;
  margin: 8px 0;
}

.stat-content p {
  margin: 0;
  color: #909399;
}

.activity-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  height: 100%;
  border: none;
}

.activity-card .card-header {
  border-bottom: 1px solid #eee;
  padding: 16px 24px;
}

.activity-card .card-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.activity-list {
  padding: 16px;
}

.activity-item {
  padding: 16px;
  border-radius: 8px;
  background: #f8f9fa;
  margin-bottom: 12px;
  transition: all 0.2s ease;
}

.activity-item:hover {
  background: #f0f2f5;
  transform: translateX(5px);
}

.activity-icon {
  font-size: 24px;
  color: #409EFF;
}

.activity-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-details strong {
  color: #303133;
}

.activity-details span {
  color: #606266;
}

.activity-details small {
  color: #909399;
}

.charts-container {
  margin-top: 32px;
}

.chart-card {
  margin-bottom: 24px;
}

.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}

.card-header h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  color: #303133;
}
</style>