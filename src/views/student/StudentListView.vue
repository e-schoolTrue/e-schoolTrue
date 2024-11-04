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
}

const router = useRouter();
const students = ref<Student[]>([]);
const filteredStudents = ref<Student[]>([]);

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
        famillyPhone: student.famillyPhone || ''
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
    router.push({ name: 'UpdateStudent', params: { id: studentId.toString() } });
  } else {
    ElMessage.error("Impossible de modifier l'étudiant : ID manquant");
  }
};

const handleFilter = (filterCriteria: any) => {
  filteredStudents.value = students.value.filter(student => {
    const nameMatch = (student.firstname?.toLowerCase().includes(filterCriteria.studentFirstName.toLowerCase()) || 
                       student.lastname?.toLowerCase().includes(filterCriteria.studentLastName.toLowerCase())) ?? true;
    const matriculeMatch = student.matricule?.includes(filterCriteria.studentPV) ?? true;
    const classMatch = !filterCriteria.schoolClass || student.classId?.toString() === filterCriteria.schoolClass;
    const yearMatch = !filterCriteria.schoolYear || student.schoolYear === filterCriteria.schoolYear;

    return nameMatch && matriculeMatch && classMatch && yearMatch;
  });
};

const handlePageChange = (page: number) => {
  console.log('Page changée:', page);
};
</script>

<template>
  <el-container>
    <el-aside width="250px">
      <el-card shadow="hover">
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold; color: #333;">
            Liste des Élèves
          </el-text>
        </el-row>
      </el-card>
    </el-aside>
    
    <el-main>
      <el-card shadow="always" class="main-card">
        <student-filter @filter="handleFilter" />
        <div class="table-container">
          <student-table 
            :students="filteredStudents"
            @detail="handleDetail" 
            @edit="handleEdit"
            @pageChange="handlePageChange"
          />
        </div>
      </el-card>
    </el-main>
  </el-container>
</template>

<style scoped>
.el-container {
  height: calc(100vh - 60px);
}

.el-aside {
  background-color: #f0f2f5;
  padding: 10px;
}

.el-main {
  padding: 20px;
}

.main-card {
  padding: 20px;
  border-radius: 8px;
  background-color: #fff;
}

.table-container {
  margin-top: 20px;
  height: calc(100% - 100px);
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
}
</style>
