<template>
  <el-container class="payment-management">
    <el-main class="main-section">
      <el-card class="payment-table-card shadow-lg">
        <template #header>
          <div class="card-header">
            <div class="stats-summary">
              <el-row :gutter="20">
                <el-col :span="8">
                  <el-statistic
                    title="Total Élèves"
                    :value="totalStudents"
                    :value-style="{ color: '#409EFF' }"
                  >
                    <template #prefix>
                      <el-icon><User /></el-icon>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="8">
                  <el-statistic
                    title="Montant Total Collecté"
                    :value="getTotalCollectedAmount()"
                    :precision="0"
                    :value-style="{ color: '#67C23A' }"
                  >
                    <template #suffix>
                      <span>FCFA</span>
                    </template>
                  </el-statistic>
                </el-col>
                <el-col :span="8">
                  <el-statistic
                    title="Reste à Collecter"
                    :value="getTotalRemainingAmount()"
                    :precision="0"
                    :value-style="{ color: '#F56C6C' }"
                  >
                    <template #suffix>
                      <span>FCFA</span>
                    </template>
                  </el-statistic>
                </el-col>
              </el-row>
            </div>
            <div class="actions-group">
              <el-input
                v-model="filters.studentFullName"
                placeholder="Rechercher par nom ou prénom"
                clearable
                @input="handleFilter"
                class="search-input"
              />
              <el-button-group>
                <el-button
                  type="success"
                  :icon="Download"
                  @click="exportToExcel"
                  class="btn-with-icon"
                >
                  Exporter
                </el-button>
                <el-button
                  type="primary"
                  :icon="Refresh"
                  @click="refreshData"
                  class="btn-with-icon"
                  :loading="loading"
                >
                  Actualiser
                </el-button>
              </el-button-group>
            </div>
          </div>
        </template>

        <div class="table-container">
          <el-table
            v-loading="loading"
            :data="filteredStudents"
            border
            stripe
            highlight-current-row
            class="payment-table"
            :height="tableHeight"
          >
            <!-- Table columns remain the same -->
            <el-table-column
              label="Matricule"
              prop="matricule"
              width="120"
              sortable
            />
            <el-table-column label="Nom" prop="lastname" sortable />
            <el-table-column label="Prénom" prop="firstname" sortable />
            <el-table-column label="Classe" width="100" sortable>
              <template #default="{ row }">
                <el-tag size="small" :type="getClassTagType(row.classId)">
                  {{ getClassName(row.classId) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              label="Montant Annuel"
              width="150"
              align="right"
              sortable
            >
              <template #default="{ row }">
                <span class="font-medium">{{
                  formatAmount(getAnnualAmount(row.classId))
                }}</span>
                <span class="text-gray-500 text-sm">FCFA</span>
              </template>
            </el-table-column>
            <el-table-column
              label="Montant Payé"
              width="150"
              align="right"
              sortable
            >
              <template #default="{ row }">
                <el-progress
                  :percentage="getPaymentProgress(row.id)"
                  :status="getProgressStatus(row.id)"
                  :format="(_val: number) => formatAmount(getPaidAmount(row.id)) + ' FCFA'"
                />
              </template>
            </el-table-column>
            <el-table-column label="Reste à payer" align="center">
              <template #default="scope">
                <el-tag
                  :type="getRemainingTagType(getRemainingAmount(scope.row.id))"
                  effect="dark"
                  class="amount-tag"
                >
                  {{
                    getRemainingAmount(scope.row.id) < 0
                      ? "soldé"
                      : formatAmount(getRemainingAmount(scope.row.id)) + " FCFA"
                  }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="Actions" width="200" fixed="right">
              <template #default="{ row }">
                <el-button-group>
                  <el-tooltip content="Ajouter un paiement" placement="top">
                    <el-button
                      type="primary"
                      @click="showPaymentDialog(row)"
                      :icon="Plus"
                      circle
                    />
                  </el-tooltip>
                  <el-tooltip
                    content="Historique des paiements"
                    placement="top"
                  >
                    <el-button
                      type="info"
                      @click="showPaymentHistory(row)"
                      :icon="Document"
                      circle
                    />
                  </el-tooltip>
                </el-button-group>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="totalStudents"
            :page-sizes="[7, 14, 21, 35]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            background
            class="pagination"
          />
        </div>
      </el-card>
    </el-main>

    <el-dialog
      v-model="paymentDialogVisible"
      title="Nouveau Paiement"
      width="500px"
      destroy-on-close
      class="payment-dialog"
    >
      <template #header="{ close }">
       
          <el-button type="danger" icon="el-icon-close" @click="close" circle />
       
      </template>

      <payment-form
        v-if="selectedStudent && getConfigForStudent(selectedStudent.classId)"
        :student-data="{
          id: selectedStudent.id,
          firstname: selectedStudent.firstname,
          lastname: selectedStudent.lastname,
          matricule: selectedStudent.matricule,
        }"
        :config-data="getConfigForStudent(selectedStudent.classId) || undefined"
        @payment-added="handlePaymentAdded"
        @cancel="paymentDialogVisible = false"
      />
    </el-dialog>

    <el-dialog
      v-model="historyDialogVisible"
      title="Historique des Paiements"
      width="70%"
      class="history-dialog"
    >
      <template #header="{ close, titleId, titleClass }">
        <div class="dialog-header">
          <h3 :id="titleId" :class="titleClass">
            <el-icon><Document /></el-icon>
            Historique des Paiements - {{ selectedStudent?.firstname }}
            {{ selectedStudent?.lastname }}
          </h3>
          <el-button type="danger" icon="el-icon-close" @click="close" circle />
        </div>
      </template>

      <payment-history
        v-if="selectedStudent"
        :student-id="selectedStudent.id"
      />
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Plus, Document, Download, Refresh } from "@element-plus/icons-vue";
import PaymentForm from "@/components/payment/PaymentForm.vue";
import PaymentHistory from "@/components/payment/PaymentHistory.vue";

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  classId: number;
  schoolYear: string;
}

interface Grade {
  id: number;
  name: string;
}

interface PaymentConfig {
  annualAmount: number;
  installments: number;
}

interface PaymentAmounts {
  paid: number;
  remaining: number;
}

const filteredStudents = ref<Student[]>([]);
  const grades = ref<Grade[]>([]);
const tableHeight = "calc(100vh - 350px)";

const students = ref<Student[]>([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(5);
const totalStudents = ref(0);
const paymentDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const selectedStudent = ref<Student | null>(null);
const classConfigs = ref(new Map<number, PaymentConfig>());
const paymentAmounts = ref(new Map<number, PaymentAmounts>());
const filters = ref({
  studentFullName: "", // Ce champ contiendra le nom ou prénom saisi
});

const loadPaymentConfigs = async () => {
  try {
    const result = await window.ipcRenderer.invoke("payment:getConfigs");
    if (result?.success && Array.isArray(result.data)) {
      classConfigs.value = new Map(
        result.data.map((config: any) => [config.classId, config])
      );
    }
  } catch (error) {
    console.error("Erreur lors du chargement des configurations:", error);
    ElMessage.error("Erreur lors du chargement des configurations de paiement");
  }
};

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result?.success && Array.isArray(result.data)) {
      grades.value = result.data;
    } else {
      console.error("Format de données invalide pour les niveaux scolaires");
      ElMessage.error("Erreur lors du chargement des niveaux scolaires");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des niveaux scolaires:", error);
    ElMessage.error("Erreur lors du chargement des niveaux scolaires");
  }
};

const getClassName = (classId: number) => {
  const grade = grades.value.find(g => g.id === classId);
  return grade ? grade.name : "N/A";
};

const formatAmount = (amount: number) => {
  return new Intl.NumberFormat("fr-FR").format(amount);
};

const getAnnualAmount = (classId: number) => {
  return classConfigs.value.get(classId)?.annualAmount || 0;
};

const getPaidAmount = (studentId: number): number => {
  return paymentAmounts.value.get(studentId)?.paid || 0;
};

const getRemainingAmount = (studentId: number): number => {
  return paymentAmounts.value.get(studentId)?.remaining || 0;
};

const getConfigForStudent = (classId: number | undefined) => {
  if (!classId) return null;
  return classConfigs.value.get(classId) || null;
};

const loadStudents = async () => {
  loading.value = true;
  try {
    const queryParams = {
      page: currentPage.value,
      limit: pageSize.value,
      ...filters.value,
    };

    const result = await window.ipcRenderer.invoke("student:all", queryParams);

    if (result?.success && Array.isArray(result.data)) {
      students.value = result.data;
      totalStudents.value = result.total || students.value.length;
      // Charger les montants immédiatement après avoir chargé les étudiants
      await loadStudentAmounts();
    }
    filteredStudents.value = students.value;
  } catch (error) {
    console.error("Erreur lors du chargement des étudiants:", error);
    ElMessage.error("Erreur lors du chargement des étudiants");
    students.value = [];
    totalStudents.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleCurrentChange = async (page: number) => {
  currentPage.value = page;
  await loadStudents();
};

const handleSizeChange = async (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  await loadStudents();
};
const handleFilter = () => {
  // Filtrage de la liste d'étudiants en fonction du nom ou prénom
  filteredStudents.value = students.value.filter((student) =>
    filters.value.studentFullName
      ? student.firstname
          .toLowerCase()
          .includes(filters.value.studentFullName.toLowerCase()) ||
        student.lastname
          .toLowerCase()
          .includes(filters.value.studentFullName.toLowerCase())
      : true
  );
};

const showPaymentDialog = (student: Student) => {
  if (!student) return;

  const configData = getConfigForStudent(student.classId);

  if (!configData) {
    ElMessage.warning(
      "Aucune configuration de paiement trouvée pour cette classe"
    );
    return;
  }

  selectedStudent.value = student;
  paymentDialogVisible.value = true;
};

const showPaymentHistory = (student: Student) => {
  selectedStudent.value = student;
  historyDialogVisible.value = true;
};

const handlePaymentAdded = async () => {
  paymentDialogVisible.value = false;
  // Recharger les montants pour l'étudiant concerné
  if (selectedStudent.value) {
    const studentId = selectedStudent.value.id;
    const [paidResult, remainingResult] = await Promise.all([
      window.ipcRenderer.invoke("payment:getByStudent", studentId),
      window.ipcRenderer.invoke("payment:getRemainingAmount", studentId),
    ]);

    if (paidResult?.success && remainingResult?.success) {
      const paidAmount = Array.isArray(paidResult.data)
        ? paidResult.data.reduce(
            (sum: number, payment: any) => sum + (payment.amount || 0),
            0
          )
        : 0;

      paymentAmounts.value.set(studentId, {
        paid: paidAmount,
        remaining: remainingResult.data?.remaining || 0,
      });
    }
  }
  ElMessage.success("Paiement ajouté avec succès");
};

const exportToExcel = () => {
  // Implementation for Excel export
  ElMessage.info("Fonctionnalité d'export en cours de développement");
};

const refreshData = () => {
  loadStudentAmounts;
  loadStudents();
};

const loadStudentAmounts = async () => {
  try {
    // Charge les montants pour tous les étudiants actuels
    await Promise.all(
      students.value.map(async (student) => {
        const [paidResult, remainingResult] = await Promise.all([
          window.ipcRenderer.invoke("payment:getByStudent", student.id),
          window.ipcRenderer.invoke("payment:getRemainingAmount", student.id),
        ]);

        if (paidResult?.success && remainingResult?.success) {
          const paidAmount = Array.isArray(paidResult.data)
            ? paidResult.data.reduce(
                (sum: number, payment: any) => sum + (payment.amount || 0),
                0
              )
            : 0;

          paymentAmounts.value.set(student.id, {
            paid: paidAmount,
            remaining: remainingResult.data?.remaining || 0,
          });
        }
      })
    );
  } catch (error) {
    console.error("Erreur lors du chargement des montants:", error);
    ElMessage.error("Erreur lors du chargement des montants de paiement");
  }
};

const getClassTagType = (classId: number) => {
  const types = ["", "success", "warning", "danger", "info", "primary"];
  return types[classId % types.length];
};

const getPaymentProgress = (studentId: number) => {
  const student = students.value.find((s) => s.id === studentId);
  if (!student) return 0;

  const annualAmount = getAnnualAmount(student.classId);
  const paidAmount = getPaidAmount(studentId);

  return Math.round((paidAmount / annualAmount) * 100);
};

const getProgressStatus = (studentId: number) => {
  const progress = getPaymentProgress(studentId);
  if (progress >= 100) return "success";
  if (progress >= 50) return "warning";
  return "exception";
};

const getRemainingTagType = (amount: number) => {
  if (amount <= 0) return "success";
  if (amount < getAnnualAmount(selectedStudent.value?.classId || 0) / 2)
    return "warning";
  return "danger";
};

const getTotalCollectedAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce(
    (sum, amounts) => sum + amounts.paid,
    0
  );
};

const getTotalRemainingAmount = () => {
  return Array.from(paymentAmounts.value.values()).reduce(
    (sum, amounts) => sum + amounts.remaining,
    0
  );
};

onMounted(async () => {
  await loadPaymentConfigs();
  await loadGrades();
  await loadStudents();
});
</script>

<style scoped>
.payment-management {
  height: 100vh;
  background-color: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.main-section {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.payment-table-card {
  height: calc(100vh - 40px); /* 40px pour le padding du main-section */
  display: flex;
  flex-direction: column;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.payment-table {
  width: 100%;
}

/* Ajustement de la hauteur du tableau en tenant compte des autres éléments */
:deep(.el-table__body-wrapper) {
  height: calc(100vh - 350px) !important;
  overflow-y: auto;
}
.filter-card {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

:deep(.el-table) {
  --el-table-border-color: #e4e7ed;
  --el-table-header-bg-color: #f5f7fa;
}

:deep(.el-tag) {
  text-transform: uppercase;
  font-weight: 500;
}

:deep(.el-progress) {
  margin-bottom: 0;
}

:deep(.el-statistic__content) {
  font-size: 24px;
}

:deep(.el-button.is-circle) {
  padding: 8px;
}
</style>
