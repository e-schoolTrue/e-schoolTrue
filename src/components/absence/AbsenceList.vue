<template>
  <el-card class="absence-list">
    <template #header>
      <div class="header-content">
        <h3>Liste des absences</h3>
        <el-button type="primary" @click="$emit('refresh')">Rafraîchir</el-button>
      </div>
    </template>
    <el-table :data="displayedAbsences" style="width: 100%" v-loading="loading">
      <el-table-column prop="studentId" label="ID Étudiant" width="120" />
      <el-table-column prop="date" label="Date" width="180">
        <template #default="scope">
          {{ new Date(scope.row.date).toLocaleDateString() }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="Raison" />
      <el-table-column prop="justified" label="Justifiée" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.justified ? 'success' : 'danger'">
            {{ scope.row.justified ? 'Oui' : 'Non' }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
    <div class="pagination-container">
      <el-pagination
        v-if="totalAbsences > pageSize"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="totalAbsences"
        layout="prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { PropType, ref, computed } from 'vue';

interface Absence {
  id: number;
  studentId: number;
  date: string;
  reason: string;
  justified: boolean;
}

const props = defineProps({
  absences: {
    type: Array as PropType<Absence[]>,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  totalAbsences: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['refresh', 'page-change']);

const currentPage = ref(1);
const pageSize = 10;

const handlePageChange = (page: number) => {
  currentPage.value = page;
  emit('page-change', page);
};

const displayedAbsences = computed(() => {
  return props.absences.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize);
});
</script>

<style scoped>
.absence-list {
  max-width: 800px;
  margin: 0 auto;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
