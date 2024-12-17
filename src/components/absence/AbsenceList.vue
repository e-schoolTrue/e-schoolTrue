<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  absences: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  student: {
    type: Object,
    default: null
  }
});

const formattedAbsences = computed(() => {
  return props.absences.map((absence: any) => ({
    ...absence,
    date: new Date(absence.date).toLocaleDateString('fr-FR'),
    status: absence.justified ? 'Justifiée' : 'Non justifiée'
  }));
});
</script>

<template>
  <el-card>
    <template #header>
      <h3>
        Absences
        <template v-if="student">
          de {{ student.firstName }} {{ student.lastName }}
        </template>
      </h3>
    </template>

    <el-table
      :data="formattedAbsences"
      v-loading="loading"
      empty-text="Sélectionnez un étudiant pour voir ses absences"
    >
      <el-table-column prop="date" label="Date" width="120" />
      <el-table-column prop="reason" label="Motif" />
      <el-table-column prop="status" label="Statut" width="120">
        <template #default="{ row }">
          <el-tag :type="row.justified ? 'success' : 'danger'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>