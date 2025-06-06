<script setup lang="ts">
import { ref, onMounted, Ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import printJS from 'print-js'; 
import StudentFilter from "@/components/student/student-filter.vue";
import StudentTable from "@/components/student/student-table.vue";
import { ElMessage } from 'element-plus';


interface Student {
  id?: number;
  firstname: string;
  lastname: string;
  matricule: string;
  schoolYear: string;
  gradeId: number;
  famillyPhone?: string;
  sex: "male" | "female";
  birthDay?: string;
  birthPlace?: string;
  address?: string;
  fatherFirstname?: string;
  fatherLastname?: string;
  motherFirstname?: string;
  motherLastname?: string;
  personalPhone?: string;
  photo?: {
    id: number;
    name: string;
    path: string;
    type: string;
  };
  documents?: Array<{
    id: number;
    name: string;
    path: string;
    type: string;
  }>;
}

interface FilterCriteria {
  studentFullName?: string;
  schoolGrade?: string;
  schoolYear?: string;
}

const router = useRouter();
const students = ref<Student[]>([]);
const filteredStudents = ref<Student[]>([]);
const printData: Ref<Student[]> = ref([]);
const schoolPrintRef = ref<ComponentPublicInstance | null>(null);
const previewPrintRef = ref<ComponentPublicInstance | null>(null);
const printDialogVisible = ref(false);
const isDetailActive = ref(false);
const isEditActive = ref(false);
const previewDialogVisible = ref(false);

onMounted(async () => {
  await loadStudents();
});

const loadStudents = async () => {
  try {
    const result = await window.ipcRenderer.invoke('student:all');
    console.log('Raw student data:', result.data); // Log raw data

    if (result.success) {
      students.value = result.data.map((student: any) => {
        const mappedStudent = {
          id: student.id,
          matricule: student.matricule,
          lastname: student.lastname,
          firstname: student.firstname,
          schoolYear: student.schoolYear,
          gradeId: student.grade ? student.grade.id : null,
          famillyPhone: student.famillyPhone || '',
          sex: student.sex || null,
          birthDay: student.birthDay,
          birthPlace: student.birthPlace,
          address: student.address,
          fatherFirstname: student.fatherFirstname,
          fatherLastname: student.fatherLastname,
          motherFirstname: student.motherFirstname,
          motherLastname: student.motherLastname,
          personalPhone: student.personalPhone,
          photo: student.photo ? {
            id: student.photo.id,
            name: student.photo.name,
            path: student.photo.path,
            type: student.photo.type
          } : undefined,
          documents: student.documents,
        };

        console.log('Mapped student:', mappedStudent); // Log mapped student
        return mappedStudent;
      });
      
      console.log('Students after mapping:', students.value); // Log students array
      filteredStudents.value = students.value;
    } else {
      ElMessage.error("Erreur lors du chargement des étudiants");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des étudiants:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement des étudiants");
  }
};

const resetFilter = () => {
  // Réinitialiser les étudiants filtrés avec la liste complète
  filteredStudents.value = students.value;
  
  // Réinitialiser les critères de filtrage si nécessaire
  filterCriteria.value = {};
};

const filterCriteria = ref<FilterCriteria>({});

const handlePrint = async (data: Student[]) => {
  if (!data || data.length === 0) {
    ElMessage.error("Aucune donnée à imprimer");
    return;
  }

  // Vérifier si les données sont filtrées par classe
  const allSameGrade = data.every((student, _i, arr) => 
    student.gradeId === arr[0].gradeId
  );

  if (!allSameGrade) {
    ElMessage.warning('Merci de filtrer par classe (grade) avant d\'imprimer');
    return;
  }

  printData.value = data;
  
  // Mettre à jour les critères de filtrage
  filterCriteria.value = {
    studentFullName: filteredStudents.value.length < students.value.length
      ? (document.querySelector('.student-filter input[placeholder="Nom ou prénom"]') as HTMLInputElement)?.value
      : '',
    schoolGrade: data[0]?.gradeId 
      ? (await getGradeName(data[0].gradeId))
      : '',
    schoolYear: data[0]?.schoolYear || ''
  };
  
  printDialogVisible.value = true;

  await nextTick();
  await new Promise(resolve => setTimeout(resolve, 500));

  const printElement = schoolPrintRef.value?.$el;
  
  if (!printElement) {
    ElMessage.error("Le template d'impression n'est pas prêt");
    return;
  }

  try {
    printJS({
      printable: printElement.id || 'school-print-template',
      type: 'html',
      documentTitle: 'Liste des étudiants',
      targetStyles: ['*'],
      scanStyles: true,
      css: [],
      onPrintDialogClose: () => {
        printDialogVisible.value = false;
        ElMessage.success("Impression terminée");
      },
      onError: (error) => {
        console.error("Erreur d'impression:", error);
        ElMessage.error("Erreur lors de l'impression");
        printDialogVisible.value = false;
      }
    });
  } catch (error) {
    console.error("Erreur lors de l'impression:", error);
    ElMessage.error("Erreur lors de l'impression");
    printDialogVisible.value = false;
  }
};

const getGradeName = async (gradeId: number): Promise<string> => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result.success && result.data) {
      const grade = result.data.find((g: any) => g.id === gradeId);
      return grade ? grade.name : '';
    }
    return '';
  } catch (error) {
    console.error("Erreur lors de la récupération du nom de la classe:", error);
    return '';
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
      await loadStudents();
    } else {
      ElMessage.error(`Échec de la suppression de l'étudiant : ${result.message}`);
    }
  } catch (error) {
    console.error("Erreur lors de la suppression de l'étudiant:", error);
    ElMessage.error("Une erreur est survenue lors de la suppression de l'étudiant");
  }
};

const handleFilter = (filterCriteria: {
  schoolYear?: string;
  classId?: string | number;
  studentFullName?: string;
}) => {
  console.log('Critères de filtrage reçus:', filterCriteria);
  
  filteredStudents.value = students.value.filter(student => {
    const nameMatch = filterCriteria.studentFullName
      ? (student.firstname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()) || 
         student.lastname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()))
      : true;
    
    const gradeMatch = filterCriteria.classId 
      ? student.gradeId === Number(filterCriteria.classId)
      : true;
    
    const yearMatch = filterCriteria.schoolYear
      ? student.schoolYear === filterCriteria.schoolYear
      : true;

    const match = nameMatch && gradeMatch && yearMatch;
    console.log('Étudiant:', student, 'Match:', match);
    return match;
  });

  console.log('Étudiants filtrés:', filteredStudents.value);
};

const handlePageChange = (page: number) => {
  console.log('Page changée:', page);
};

const handlePreview = async (data: Student[]) => {
  if (!data || data.length === 0) {
    ElMessage.error("Aucune donnée à afficher");
    return;
  }

  printData.value = data;
  
  // Mettre à jour les critères de filtrage
  filterCriteria.value = {
    studentFullName: filteredStudents.value.length < students.value.length
      ? (document.querySelector('.student-filter input[placeholder="Nom ou prénom"]') as HTMLInputElement)?.value
      : '',
    schoolGrade: data[0]?.gradeId 
      ? (await getGradeName(data[0].gradeId))
      : '',
    schoolYear: data[0]?.schoolYear || ''
  };
  
  previewDialogVisible.value = true;
};

const proceedWithPrint = () => {
  previewDialogVisible.value = false;
  // Attendre que la dialog soit fermée avant d'imprimer
  setTimeout(async () => {
    printDialogVisible.value = true;
    await nextTick();
    
    const printElement = schoolPrintRef.value?.$el;
    if (!printElement) {
      ElMessage.error("Le template d'impression n'est pas prêt");
      return;
    }

    try {
      printJS({
        printable: printElement.id || 'school-print-template',
        type: 'html',
        documentTitle: 'Liste des étudiants',
        targetStyles: ['*'],
        scanStyles: true,
        css: [],
        onPrintDialogClose: () => {
          printDialogVisible.value = false;
          ElMessage.success("Impression terminée");
        },
        onError: (error) => {
          console.error("Erreur d'impression:", error);
          ElMessage.error("Erreur lors de l'impression");
          printDialogVisible.value = false;
        }
      });
    } catch (error) {
      console.error("Erreur lors de l'impression:", error);
      ElMessage.error("Erreur lors de l'impression");
      printDialogVisible.value = false;
    }
  }, 300);
};
</script>

<template>
  <div class="student-list-container">
    <student-filter 
    @filter="handleFilter"
    @reset="resetFilter"
    />
    <student-table 
      :students="filteredStudents"
      @detail="handleDetail" 
      @edit="handleEdit"
      @delete="handleDeleteStudent"
      @pageChange="handlePageChange"
      @print="handlePrint"
      @preview="handlePreview"
    />
    
    <!-- Dialog pour l'aperçu -->
    <el-dialog
      v-model="previewDialogVisible"
      title="Aperçu avant impression"
      width="90%"
      :fullscreen="true"
      custom-class="preview-dialog"
      destroy-on-close
    >
      <SchoolPrintTemplate
        v-if="previewDialogVisible"
        ref="previewPrintRef"
        :students="printData"
        :filter-criteria="filterCriteria"
      />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="previewDialogVisible = false">Fermer</el-button>
          <el-button type="primary" @click="proceedWithPrint">
            Imprimer
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Template caché pour l'impression -->
    <div v-show="false">
      <SchoolPrintTemplate
        v-if="printDialogVisible"
        ref="schoolPrintRef"
        :students="printData"
        :filter-criteria="filterCriteria"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-dialog {
  display: flex;
  flex-direction: column;
}

.preview-dialog :deep(.el-dialog__body) {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background-color: #f5f5f5;
}

.preview-dialog :deep(.el-dialog__header) {
  padding: 15px 20px;
  margin-right: 0;
  border-bottom: 1px solid #dcdfe6;
}

.preview-dialog :deep(.el-dialog__footer) {
  border-top: 1px solid #dcdfe6;
  padding: 15px 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>