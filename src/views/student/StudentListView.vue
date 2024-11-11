<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import StudentFilter from "@/components/student/student-filter.vue";
import StudentTable from "@/components/student/student-table.vue";
import { ElMessage } from 'element-plus';

interface Student {
  id?: number;
  firstname: string;
  lastname: string;
  matricule: string;
  schoolYear: string;
  classId?: number;
  famillyPhone?: string;
  sex: "male" | "female";
}

const router = useRouter();
const students = ref<Student[]>([]);
const filteredStudents = ref<Student[]>([]);

const isDetailActive = ref(false);
const isEditActive = ref(false);

onMounted(async () => {
  await loadStudents();
});

const loadStudents = async () => {
  try {
    const result = await window.ipcRenderer.invoke('student:all');
    if (result.success) {
      students.value = result.data.map((student: any) => ({
        id: student.id,
        matricule: student.matricule,
        lastname: student.lastname,
        firstname: student.firstname,
        schoolYear: student.schoolYear,
        classId: student.classId !== null ? Number(student.classId) : null,
        famillyPhone: student.famillyPhone || '',
        sex: student.sex || null // Si pas de genre défini, on met null
      }));
      filteredStudents.value = students.value;
    } else {
      ElMessage.error("Erreur lors du chargement des étudiants");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des étudiants:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement des étudiants");
  }
};
const handleDetail = (student: Student) => {
  if (student && student.id) {
    isDetailActive.value = true;
    router.push({ name: 'StudentDetails', params: { id: student.id.toString() } });
  } else {
    ElMessage.error("Impossible d'afficher les détails : ID de l'étudiant manquant");
  }
};

const handleEdit = (studentOrId: Student | number) => {
  let studentId: number | undefined;

  if (typeof studentOrId === 'object' && studentOrId !== null) {
    studentId = studentOrId.id;
  } else if (typeof studentOrId === 'number') {
    studentId = studentOrId;
  }

  if (studentId !== undefined) {
    isEditActive.value = true;
    router.push({ name: 'UpdateStudent', params: { id: studentId.toString() } });
  } else {
    ElMessage.error("Impossible de modifier l'étudiant : ID manquant");
  }
};

const handleDeleteStudent = async (studentId: number) => {
  try {
    const result = await window.ipcRenderer.invoke("delete-student", studentId);
    if (result.success) {
      ElMessage.success("L'étudiant a été supprimé avec succès");
      // Rafraîchir la liste après suppression
      await loadStudents();
    } else {
      ElMessage.error(`Échec de la suppression de l'étudiant : ${result.message}`);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression de l'étudiant:", error);
    ElMessage.error("Une erreur est survenue lors de la suppression de l'étudiant");
  }
};

const handleFilter = (filterCriteria: any) => {
  filteredStudents.value = students.value.filter(student => {
    const nameMatch = filterCriteria.studentFullName
      ? (student.firstname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()) || 
         student.lastname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()))
      : true;
    const classMatch = !filterCriteria.schoolClass || student.classId?.toString() === filterCriteria.schoolClass;
    const yearMatch = !filterCriteria.schoolYear || student.schoolYear === filterCriteria.schoolYear;

    return nameMatch && classMatch && yearMatch;
  });
};

const handlePageChange = (page: number) => {
  console.log('Page changée:', page);
};
</script>

<template>
  <student-filter @filter="handleFilter" />
  <student-table 
    :students="filteredStudents"
    @detail="handleDetail" 
    @edit="handleEdit"
    @delete="handleDeleteStudent"
    @pageChange="handlePageChange"
  />
</template>

<style scoped>
</style>
