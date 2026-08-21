<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElTable, ElSelect, ElOption, ElPagination, ElButton, ElInput, ElCard, ElSpace, ElTag, ElProgress, ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import type { StudentRanking, RankingFilters } from '@/types/ranking'
import { Icon as IconifyIcon } from '@iconify/vue'

const props = defineProps<{
  classId?: number
  gradeId?: number
  subjectId?: number
  period?: string
}>()

const loading = ref(false)
const rankings = ref<StudentRanking[]>([])
const filteredRankings = ref<StudentRanking[]>([])

const filters = reactive<RankingFilters>({
  classId: props.classId,
  gradeId: props.gradeId,
  subjectId: props.subjectId,
  period: props.period
})

const searchQuery = ref('')

const paginator = reactive({
  totalPage: 0,
  pageSize: 10,
  currentPage: 1
})

const tableData = computed(() => {
  const start = (paginator.currentPage - 1) * paginator.pageSize
  const end = paginator.currentPage * paginator.pageSize
  return filteredRankings.value.slice(start, end)
})

const totalPage = computed(() => Math.ceil(filteredRankings.value.length / paginator.pageSize))

const filteredRankingsBase = computed(() => {
  if (!searchQuery.value) {
    return rankings.value
  }
  const query = searchQuery.value.toLowerCase().trim()
  return rankings.value.filter(r => {
    const first = r.firstname.toLowerCase()
    const last = r.lastname.toLowerCase()
    const full = `${first} ${last}`
    const rev = `${last} ${first}`
    return full.includes(query) || rev.includes(query) || first.includes(query) || last.includes(query) || r.studentId.toString().includes(query)
  })
})

watch(filteredRankingsBase, (newRankings) => {
  filteredRankings.value = newRankings
  paginator.currentPage = 1
  paginator.totalPage = Math.ceil(newRankings.length / paginator.pageSize)
})

async function loadRankings() {
  loading.value = true
  try {
    const response = await window.ipcRenderer.invoke('gradeEntry:getCentralizedRankings', filters)
    if (response.success && response.data) {
      rankings.value = response.data
      filteredRankings.value = response.data
      if (response.data.length > 0) {
        ElMessage.success(`${response.data.length} élèves trouvés`)
      }
    } else {
      ElMessage.error(response.message || 'Erreur lors du chargement des classements')
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classements:', error)
    ElMessage.error('Erreur lors du chargement des classements')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  paginator.currentPage = page
}

function handleSearch() {
  filteredRankings.value = filteredRankingsBase.value
}

function getGradeColor(average: number) {
  if (average >= 16) return { color: '#67C23A', text: 'success' }
  if (average >= 14) return { color: '#E6A23C', text: 'warning' }
  if (average >= 10) return { color: '#409EFF', text: 'primary' }
  return { color: '#F56C6C', text: 'danger' }
}

function getRankIcon(rank: number) {
  if (rank === 1) return 'solar:trophy-2-bold'
  if (rank === 2) return 'solar:trophy-bold'
  if (rank === 3) return 'solar:trophy-bold-stroke-rounded'
  return 'solar:user-id-bold'
}

function getRankColor(rank: number) {
  if (rank === 1) return '#FFD700'
  if (rank === 2) return '#C0C0C0'
  if (rank === 3) return '#CD7F32'
  return '#FFFFFF'
}

onMounted(() => {
  loadRankings()
})

watch(() => props, () => {
  Object.assign(filters, props)
  loadRankings()
}, { deep: true })
</script>

<template>
<!-- @ts-nocheck-->
  <div class="centralized-grades-container">
    <el-scrollbar height="580">
      <div class="content">
        <el-space direction="vertical" style="width: 100%">
          <el-space size="large">
            <Icon width="25" icon="material-symbols:grade-outline" color="#32CD32"/>
            <el-text type="primary" style="font-size: 20px">Fiche de Centralisation des Notes</el-text>
          </el-space>

          <el-card shadow="always">
            <el-space direction="vertical" size="large">
              <el-space  >
                <el-tag type="info" effect="plain">Visualisation et classement des résultats scolaires</el-tag>
              </el-space>

              <el-space size="small" :wrap="true">
                <el-select v-model="filters.classId" placeholder="Sélectionner une classe" clearable style="width: 200px">
                  <el-option label="Toutes les classes" value="" />
                  <el-option v-for="classItem in [1, 2, 3]" :key="classItem" :label="`Classe ${classItem}`" :value="classItem" />
                </el-select>

                <el-select v-model="filters.gradeId" placeholder="Sélectionner un niveau" clearable style="width: 200px">
                  <el-option label="Tous les niveaux" value=""/>
                  <el-option label="6ème" value="6" />
                  <el-option label="5ème" value="5" />
                  <el-option label="4ème" value="4" />
                  <el-option label="3ème" value="3" />
                </el-select>

                <el-select v-model="filters.subjectId" placeholder="Sélectionner une matière" clearable style="width: 200px">
                  <el-option label="Toutes les matières" value="" />
                  <el-option label="Mathématiques" value="maths" />
                  <el-option label="Français" value="francais" />
                  <el-option label="Anglais" value="anglais" />
                  <el-option label="Physique-Chimie" value="physique" />
                </el-select>

                <el-select v-model="filters.period" placeholder="Période" clearable style="width: 150px">
                  <el-option label="Trimestre 1" value="Trimestre 1" />
                  <el-option label="Trimestre 2" value="Trimestre 2" />
                  <el-option label="Trimestre 3" value="Trimestre 3" />
                  <el-option label="Semestre 1" value="Semestre 1" />
                  <el-option label="Semestre 2" value="Semestre 2" />
                </el-select>

                <el-input
                  v-model="searchQuery"
                  placeholder="Rechercher un élève..."
                  style="width: 250px"
                  clearable
                  @keyup.enter="handleSearch"
                >
                  <template #prepend>
                    <Icon width="20" icon="akar-icons:search"/>
                  </template>
                </el-input>

                <el-button type="primary" @click="loadRankings">
                  Actualiser
                </el-button>
              </el-space>
            </el-space>
          </el-card>

          <el-card v-loading="loading" shadow="hover">
            <el-table :data="tableData" style="width: 100%" :border="true" stripe>
              <el-table-column type="index" label="Rang" width="80" fixed />
              <el-table-column label="Image" width="70" align="center">
                <template #default="{ row }">
                  <div class="avatar-container">
                    <div class="avatar" :style="{ backgroundColor: getRankColor(row.rank) }">
                      <IconifyIcon :icon="getRankIcon(row.rank)" color="#FFFFFF" width="30" />
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="firstname" label="Prénom" min-width="100" fixed />
              <el-table-column prop="lastname" label="Nom" min-width="100" fixed />
              <el-table-column label="Matricule" min-width="100">
                <template #default="{ row }">
                  <el-tag type="info">{{ row.studentId }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Moyenne Générale" width="150" align="center">
                <template #default="{ row }">
                  <div class="grade-cell">
                    <el-progress
                      :percentage="Math.round((row.generalAverage / 20) * 100)"
                      :color="getGradeColor(row.generalAverage).color"
                      :stroke-width="12"
                      :show-text="true"
                    >
                      <span class="grade-text">{{ row.generalAverage }}/20</span>
                    </el-progress>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="Notes par matière" min-width="400">
                <template #default="{ row }">
                  <el-space :size="8" :wrap="true">
                    <el-tag
                      v-for="score in row.scores"
                      :key="score.courseId"
                      :type="score.score >= 10 ? 'success' : 'danger'"
                      effect="plain"
                      size="small"
                    >
                      {{ score.courseName }}: {{ score.score }}/20
                    </el-tag>
                  </el-space>
                </template>
              </el-table-column>
              <el-table-column label="Statistiques" width="180" align="center">
                <template #default="{ row }">
                  <div class="stats-cell">
                    <div class="stat-item">
                      <el-text type="info" size="small">Total coefficients</el-text>
                      <div class="stat-value">{{ row.totalScores }}</div>
                    </div>
                    <div class="stat-item">
                      <el-text type="info" size="small">Moyenne non-pondérée</el-text>
                      <div class="stat-value">{{ row.averageScores }}/20</div>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="Actions" width="150" align="center" fixed="right">
                <template #default="">
                  <el-space>
                    <el-button size="small" type="primary" >
                      Détails
                    </el-button>
                    <el-button size="small" type="success">
                      Export
                    </el-button>
                  </el-space>
                </template>
              </el-table-column>
            </el-table>

            <el-pagination
              v-if="totalPage > 0"
              :page-count="totalPage"
              :page-size="paginator.pageSize"
              :current-page="paginator.currentPage"
              @current-change="handlePageChange"
              style="display: flex; justify-content: center; margin-top: 20px"
              background
              layout="prev, pager, next"
              :total="filteredRankingsBase.length"
            />
          </el-card>

          <el-space v-if="rankings.length > 0" :wrap="true">
            <el-card shadow="hover" style="flex: 1; min-width: 300px">
              <div class="stat-card">
                <el-space size="large">
                  <Icon width="30" icon="solar:user-id-bold" color="#409EFF"/>
                  <div>
                    <div class="stat-number">{{ rankings.length }}</div>
                    <div class="stat-label">Total des élèves</div>
                  </div>
                </el-space>
              </div>
            </el-card>

            <el-card shadow="hover" style="flex: 1; min-width: 300px">
              <div class="stat-card">
                <el-space size="large">
                  <Icon width="30" icon="solar:trophy-2-bold" color="#FFD700"/>
                  <div>
                    <div class="stat-number">{{ rankings.find(r => r.rank === 1)?.generalAverage.toFixed(2) || '0' }}/20</div>
                    <div class="stat-label">Meilleure moyenne</div>
                  </div>
                </el-space>
              </div>
            </el-card>

            <el-card shadow="hover" style="flex: 1; min-width: 300px">
              <div class="stat-card">
                <el-space size="large">
                  <Icon width="30" icon="solar:average-line-bold" color="#67C23A"/>
                  <div>
                    <div class="stat-number">
                      {{ (rankings.reduce((sum, r) => sum + r.generalAverage, 0) / rankings.length).toFixed(2) }}/20
                    </div>
                    <div class="stat-label">Moyenne de classe</div>
                  </div>
                </el-space>
              </div>
            </el-card>

            <el-card shadow="hover" style="flex: 1; min-width: 300px">
              <div class="stat-card">
                <el-space size="large">
                  <Icon width="30" icon="solar:stars-bold" color="#E6A23C"/>
                  <div>
                    <div class="stat-number">
                      {{ rankings.filter(r => r.generalAverage >= 16).length }}
                    </div>
                    <div class="stat-label">Élèves avec ≥ 16/20</div>
                  </div>
                </el-space>
              </div>
            </el-card>
          </el-space>
        </el-space>
      </div>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.centralized-grades-container {
  width: 100%;
  height: 100%;
}

.content {
  padding: 10px;
}

.avatar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid #FFFFFF;
}

.grade-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.grade-text {
  font-weight: bold;
  font-size: 14px;
  color: #606266;
}

.stats-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 14px;
  font-weight: bold;
  color: #409EFF;
}

.stat-card {
  padding: 10px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

:deep(.el-table) {
  font-size: 13px;
}

:deep(.el-table th) {
  background-color: #F5F7FA;
  font-weight: 600;
}

:deep(.el-table__row:hover td) {
  background-color: #F5F7FA;
}

:deep(.el-pagination) {
  margin-top: 20px;
}

:deep(.el-progress__text) {
  font-weight: bold;
  font-size: 14px;
}
</style>
