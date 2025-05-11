<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import type { ComponentPublicInstance } from 'vue';
import StudentFilter from "@/components/student/student-filter.vue";
import StudentTable from "@/components/student/student-table.vue";
import SchoolPrintTemplate from "@/components/student/school-print-template.vue";
import { ElMessage } from 'element-plus';
import type { IStudentDetails, IStudentFile } from '@/types/student';
import type { IFilterCriteria } from '@/types/shared';
import { Icon } from '@iconify/vue';

// Interface pour student-table
interface StudentTableItem {
  id: number;
  firstname: string;
  lastname: string;
  matricule?: string;
  birthDay?: Date | null;
  birthPlace?: string;
  address?: string;
  fatherFirstname?: string;
  fatherLastname?: string;
  motherFirstname?: string;
  motherLastname?: string;
  famillyPhone?: string;
  personalPhone?: string;
  sex?: "male" | "female";
  schoolYear?: string;
  gradeId?: number;
  photo?: IStudentFile;
  documents: IStudentFile[];
  grade: {
    id: number;
    name: string;
    code: string;
  } | undefined;
}

// Interface pour les composants d'impression
type PrintStudent = IStudentDetails;

const router = useRouter();
const students = ref<StudentTableItem[]>([]);
const filteredStudents = ref<StudentTableItem[]>([]);
const printData = ref<PrintStudent[]>([]);
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
    console.log('Raw student data:', result.data);

    if (result.success) {
      students.value = result.data.map((student: IStudentDetails) => {
        const mappedStudent: StudentTableItem = {
          id: student.id,
          matricule: student.matricule || '',
          lastname: student.lastname,
          firstname: student.firstname,
          schoolYear: student.schoolYear || '',
          gradeId: student.grade?.id || 0,
          grade: student.grade ? {
            id: student.grade.id,
            name: student.grade.name || '',
            code: student.grade.code || ''
          } : undefined,
          famillyPhone: student.famillyPhone || '',
          sex: student.sex || 'male',
          birthDay: student.birthDay ? new Date(student.birthDay) : null,
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
            type: student.photo.type
          } : undefined,
          documents: student.documents.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: doc.type
          }))
        };

        console.log('Mapped student:', mappedStudent);
        return mappedStudent;
      });
      
      console.log('Students after mapping:', students.value);
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
  filteredStudents.value = students.value;
  filterCriteria.value = {};
};

const filterCriteria = ref<IFilterCriteria>({});

const handlePrint = async (data: StudentTableItem[]) => {
  if (!data || data.length === 0) {
    ElMessage.error("Aucune donnée à imprimer");
    return;
  }

  const allSameGrade = data.every((student, _i, arr) => 
    student.gradeId === arr[0].gradeId
  );

  if (!allSameGrade) {
    ElMessage.warning('Merci de filtrer par classe (grade) avant d\'imprimer');
    return;
  }

  // Convertir les données pour l'impression
  printData.value = data.map(student => ({
    ...student,
    photo: student.photo ? {
      id: student.photo.id,
      name: student.photo.name,
      type: student.photo.type,
      path: '',
      createdAt: new Date()
    } : null,
    grade: student.grade ? {
      id: student.grade.id,
      name: student.grade.name,
      code: student.grade.code,
      description: ''
    } : null
  })) as IStudentDetails[];
  
  filterCriteria.value = {
    studentFullName: filteredStudents.value.length < students.value.length
      ? (document.querySelector('.student-filter input[placeholder="Nom ou prénom"]') as HTMLInputElement)?.value
      : '',
    schoolGrade: data[0]?.gradeId 
      ? (await getGradeName(data[0].gradeId))
      : '',
    schoolYear: data[0]?.schoolYear || ''
  };
  
  proceedWithPrint();
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

const handleDetail = (student: StudentTableItem) => {
  if (student && student.id) {
    isDetailActive.value = true;
    router.push({ name: 'StudentDetails', params: { id: student.id.toString() } });
  } else {
    ElMessage.error("Impossible d'afficher les détails : ID de l'étudiant manquant");
  }
};

const handleEdit = (studentOrId: StudentTableItem | number) => {
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
  
  // Si le filtre est basé sur l'ID de la classe, utiliser directement ce filtre
  if (filterCriteria.classId) {
    filteredStudents.value = students.value.filter(student => {
      const nameMatch = filterCriteria.studentFullName
        ? (student.firstname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()) || 
           student.lastname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()))
        : true;
      
      const gradeMatch = student.gradeId === Number(filterCriteria.classId);
      
      const yearMatch = filterCriteria.schoolYear
        ? student.schoolYear === filterCriteria.schoolYear
        : true;

      const match = nameMatch && gradeMatch && yearMatch;
      console.log('Étudiant:', student, 'Match:', match);
      return match;
    });
  } else {
    // Filtrage standard sans filtre par classe
    filteredStudents.value = students.value.filter(student => {
      const nameMatch = filterCriteria.studentFullName
        ? (student.firstname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()) || 
           student.lastname.toLowerCase().includes(filterCriteria.studentFullName.toLowerCase()))
        : true;
      
      const yearMatch = filterCriteria.schoolYear
        ? student.schoolYear === filterCriteria.schoolYear
        : true;

      return nameMatch && yearMatch;
    });
  }

  console.log('Étudiants filtrés:', filteredStudents.value);
};

const handlePageChange = (page: number) => {
  console.log('Page changée:', page);
};

const handlePreview = async (data: StudentTableItem[]) => {
  if (!data || data.length === 0) {
    ElMessage.error("Aucune donnée à afficher");
    return;
  }

  printData.value = data.map(student => ({
    ...student,
    photo: student.photo ? {
      id: student.photo.id,
      name: student.photo.name,
      type: student.photo.type,
      path: '',
      createdAt: new Date()
    } : null,
    grade: student.grade ? {
      id: student.grade.id,
      name: student.grade.name,
      code: student.grade.code,
      description: ''
    } : null
  })) as IStudentDetails[];
  
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
  printDialogVisible.value = true;
  
  nextTick(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const printElement = document.getElementById('school-print-template');
      if (!printElement) {
        ElMessage.error("Le template d'impression n'est pas prêt");
        printDialogVisible.value = false;
        return;
      }

      // Créer une copie de l'élément pour l'impression
      const printContent = printElement.cloneNode(true) as HTMLElement;
      
      // Créer un conteneur pour l'impression
      const printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.appendChild(printContent);
      document.body.appendChild(printContainer);

      // Configurer les styles d'impression
      const style = document.createElement('style');
      style.textContent = `
        @media print {
          @page {
            margin: 20mm;
            size: portrait;
          }
          body > *:not(#print-container) {
            display: none !important;
          }
          #print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            transform: none !important;
          }
          #print-container * {
            visibility: visible !important;
            transform: none !important;
          }
          .print-header {
            display: block !important;
            page-break-inside: avoid;
            transform: none !important;
          }
          .school-info {
            display: flex !important;
            page-break-inside: avoid;
            transform: none !important;
          }
          .logo-container {
            display: flex !important;
            transform: none !important;
          }
          .school-logo {
            display: block !important;
            max-width: 100%;
            height: auto;
            transform: none !important;
          }
          .school-details {
            display: block !important;
            transform: none !important;
          }
          .document-title {
            display: block !important;
            page-break-inside: avoid;
            transform: none !important;
          }
          .print-table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px !important;
            transform: none !important;
          }
          .print-table thead {
            display: table-header-group !important;
            transform: none !important;
          }
          .print-table tbody {
            display: table-row-group !important;
            transform: none !important;
          }
          .print-table tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            transform: none !important;
          }
          .print-table th,
          .print-table td {
            display: table-cell !important;
            padding: 8px !important;
            border: 1px solid #000 !important;
            text-align: left !important;
            font-size: 12px !important;
            transform: none !important;
          }
          .print-table th {
            background-color: #f5f5f5 !important;
            font-weight: bold !important;
          }
          .print-table tr:nth-child(even) {
            background-color: #f9f9f9 !important;
          }
        }
      `;
      document.head.appendChild(style);

      // Lancer l'impression
      window.print();

      // Nettoyer après l'impression
      document.body.removeChild(printContainer);
      document.head.removeChild(style);
      printDialogVisible.value = false;

      ElMessage.success("Impression terminée");
    } catch (error) {
      console.error("Erreur lors de l'impression:", error);
      ElMessage.error("Erreur lors de l'impression");
      printDialogVisible.value = false;
    }
  });
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
    
    <el-button 
      type="primary" 
      class="floating-add-btn" 
      circle
      size="large"
      @click="router.push({ name: 'AddStudent' })"
      title="Ajouter un étudiant"
    >
      <Icon icon="mdi:account-plus" width="24" height="24" />
    </el-button>
    
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
        id="school-print-template"
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

.floating-add-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>