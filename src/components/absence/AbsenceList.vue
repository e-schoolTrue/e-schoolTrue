<script setup lang="ts">
import { computed } from 'vue';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  grade: {
    id: number;
    name: string;
  };
}

interface Absence {
  id: number;
  date: string;
  reason: string;
  justified: boolean;
  student: Student;
  professorId: number | null;
}

const props = defineProps<{
  absences: Absence[];
  loading: boolean;
  student?: Student | null;
}>();

const formattedAbsences = computed(() => {
  // Filtrer pour n'avoir que les absences des étudiants
  return props.absences
    .filter(absence => !absence.professorId)
    .map((absence) => ({
      ...absence,
      date: new Date(absence.date).toLocaleDateString('fr-FR'),
      status: absence.justified ? 'Justifiée' : 'Non justifiée',
      studentName: `${absence.student?.firstname} ${absence.student?.lastname}`,
      className: absence.student?.grade?.name
    }));
});
</script>

<template>
  <el-card>
    <template #header>
      <h3>
        Absences
        <template v-if="student">
          de {{ student.firstname }} {{ student.lastname }}
        </template>
      </h3>
    </template>

    <el-table
      :data="formattedAbsences"
      v-loading="loading"
      empty-text="Aucune absence trouvée"
    >
      <el-table-column prop="date" label="Date" width="120" />
      <el-table-column prop="studentName" label="Élève" />
      <el-table-column prop="className" label="Classe" />
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