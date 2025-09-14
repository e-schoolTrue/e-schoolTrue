<template>
  <div class="p-4">
    <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
      <div>
        <label for="period" class="block text-sm font-medium text-gray-700">Période</label>
        <select id="period" v-model="selectedPeriod" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
          <option v-for="period in periods" :key="period.id" :value="period.name">{{ period.name }}</option>
        </select>
      </div>
      <div>
        <label for="grade" class="block text-sm font-medium text-gray-700">Classe</label>
        <select id="grade" v-model="selectedGrade" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
          <option v-for="grade in grades" :key="grade.id" :value="grade.id">{{ grade.name }}</option>
        </select>
      </div>
      <div class="flex items-end">
        <button @click="loadData" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Charger
        </button>
      </div>
      <div class="flex items-end">
        <button @click="saveGrades" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded" :disabled="!isModified">
          Enregistrer
        </button>
      </div>
      <div class="flex items-end">
        <button @click="showPrintModal = true" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
          Imprimer
        </button>
      </div>
    </div>

    <!-- Print Modal -->
    <div v-if="showPrintModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" aria-hidden="true">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900">Imprimer les bulletins</h3>
            <div class="mt-4">
              <label class="block text-sm font-medium text-gray-700">Imprimer pour:</label>
              <select v-model="printOption" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                <option value="all">Toute la classe</option>
                <option value="one">Un seul élève</option>
              </select>
            </div>
            <div v-if="printOption === 'one'" class="mt-4">
              <label class="block text-sm font-medium text-gray-700">Élève:</label>
              <select v-model="selectedStudentForPrint" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                <option v-for="student in students" :key="student.id" :value="student.id">{{ student.firstname }} {{ student.lastname }}</option>
              </select>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button @click="printReportCards" type="button" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
              Imprimer
            </button>
            <button @click="showPrintModal = false" type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-center">
      <p>Chargement...</p>
    </div>
    <div v-else-if="tableData.length > 0" class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Élève
            </th>
            <th v-for="course in courses" :key="course.id" scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {{ course.name }}
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Moyenne
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="studentData in tableData" :key="studentData.student.id">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ studentData.student.firstname }} {{ studentData.student.lastname }}
            </td>
            <td v-for="course in courses" :key="course.id" class="px-6 py-4 whitespace-nowrap">
              <EditableCell 
                v-model="studentData.grades[course.id!].grade"
                :is-modified="studentData.grades[course.id!].isModified"
                @update:modelValue="markAsModified(studentData.grades[course.id!])"
              />
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ studentAverages[studentData.student.id!] }}
            </td>
          </tr>
          <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Moyenne Classe</td>
            <td v-for="course in courses" :key="course.id" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ courseAverages[course.id!] }}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else>
      <p>Veuillez sélectionner une période et une classe, puis cliquez sur "Charger".</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { YearRepartitionEntity } from '#electron/backend/entities/yearRepartition';
import { GradeEntity } from '#electron/backend/entities/grade';
import { StudentEntity } from '#electron/backend/entities/students';
import { CourseEntity } from '#electron/backend/entities/course';
import EditableCell from '@/components/grade/EditableCell.vue';

const periods = ref<any[]>([]);
const grades = ref<GradeEntity[]>([]);
const selectedPeriod = ref<string | null>(null);
const selectedGrade = ref<number | null>(null);
const students = ref<StudentEntity[]>([]);
const courses = ref<CourseEntity[]>([]);
const studentGrades = ref<any[]>([]);
const loading = ref(false);
const isModified = ref(false);
const showPrintModal = ref(false);
const printOption = ref('all');
const selectedStudentForPrint = ref<number | null>(null);

onMounted(async () => {
  try {
    const periodsResponse = await window.ipcRenderer.invoke('yearRepartition:getAll');
    if (periodsResponse.success) {
      periods.value = periodsResponse.data.flatMap((year: YearRepartitionEntity) => year.periodConfigurations.map(p => ({...p, id: `${year.id}-${p.name}`})));
    }

    const gradesResponse = await window.ipcRenderer.invoke('grade:all');
    if (gradesResponse.success) {
      grades.value = gradesResponse.data;
    }
  } catch (error) {
    console.error('Error fetching initial data:', error);
  }
});

const tableData = computed(() => {
  return students.value.map(student => {
    const gradesForStudent = studentGrades.value.find(sg => sg.studentId === student.id)?.grades.grades || [];
    const studentCourseGrades = courses.value.reduce((acc, course) => {
      const gradeInfo = gradesForStudent.find((g: { courseId: number | undefined; }) => g.courseId === course.id!);
      acc[course.id!] = {
        grade: gradeInfo ? gradeInfo.average : null,
        isModified: false,
        courseId: course.id!,
        studentId: student.id!
      };
      return acc;
    }, {} as { [courseId: number]: { grade: number | null, isModified: boolean, courseId: number, studentId: number } });

    return {
      student,
      grades: studentCourseGrades
    };
  });
});

const studentAverages = computed(() => {
  const averages: { [studentId: number]: number } = {};
  tableData.value.forEach(studentData => {
    const studentGrades = Object.values(studentData.grades).map(g => g.grade).filter(g => g !== null) as number[];
    if (studentGrades.length > 0) {
      const sum = studentGrades.reduce((a, b) => a + b, 0);
      averages[studentData.student.id!] = parseFloat((sum / studentGrades.length).toFixed(2));
    } else {
      averages[studentData.student.id!] = 0;
    }
  });
  return averages;
});

const courseAverages = computed(() => {
  const averages: { [courseId: number]: number } = {};
  courses.value.forEach(course => {
    const courseGrades = tableData.value.map(sd => sd.grades[course.id!].grade).filter(g => g !== null) as number[];
    if (courseGrades.length > 0) {
      const sum = courseGrades.reduce((a, b) => a + b, 0);
      averages[course.id!] = parseFloat((sum / courseGrades.length).toFixed(2));
    } else {
      averages[course.id!] = 0;
    }
  });
  return averages;
});

const markAsModified = (grade: { isModified: boolean; }) => {
  grade.isModified = true;
  isModified.value = true;
};

const loadData = async () => {
  if (!selectedPeriod.value || !selectedGrade.value) {
    alert('Veuillez sélectionner une période et une classe.');
    return;
  }

  loading.value = true;
  isModified.value = false;
  try {
    const studentsResponse = await window.ipcRenderer.invoke('student:getByGrade', selectedGrade.value);
    if (studentsResponse.success) {
      students.value = studentsResponse.data;
    }

    const coursesResponse = await window.ipcRenderer.invoke('course:all');
    if (coursesResponse.success) {
      courses.value = coursesResponse.data;
    }

    const gradesData = [];
    for (const student of students.value) {
      const studentGradeResponse = await window.ipcRenderer.invoke('grades:get', { studentId: student.id, period: selectedPeriod.value });
      if (studentGradeResponse.success) {
        gradesData.push({ studentId: student.id, grades: studentGradeResponse.data });
      }
    }
    studentGrades.value = gradesData;

  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    loading.value = false;
  }
};

const saveGrades = async () => {
  if (!isModified.value) return;

  try {
    for (const studentData of tableData.value) {
      const modifiedGrades = Object.values(studentData.grades).filter(g => g.isModified);
      if (modifiedGrades.length > 0) {
        const gradesToSave = modifiedGrades.map(g => ({
          courseId: g.courseId,
          assignments: [], // For now, we only handle the final grade
          exam: g.grade, // We save the grade as exam grade
          average: g.grade,
          appreciation: ''
        }));

        await window.ipcRenderer.invoke('grades:save', {
          studentId: studentData.student.id,
          period: selectedPeriod.value,
          grades: gradesToSave
        });
      }
    }
    isModified.value = false;
    alert('Notes enregistrées avec succès!');
  } catch (error) {
    console.error('Error saving grades:', error);
    alert('Erreur lors de l\'enregistrement des notes.');
  }
};

const printReportCards = async () => {
  if (!selectedPeriod.value) {
    alert('Veuillez sélectionner une période.');
    return;
  }

  let studentIds: number[] = [];
  if (printOption.value === 'all') {
    studentIds = students.value.map(s => s.id);
  } else if (selectedStudentForPrint.value) {
    studentIds = [selectedStudentForPrint.value];
  }

  if (studentIds.length === 0) {
    alert('Veuillez sélectionner au moins un élève.');
    return;
  }

  try {
    await window.ipcRenderer.invoke('report:generateMultiple', {
      studentIds,
      period: selectedPeriod.value,
    });
    alert('Impression lancée avec succès!');
  } catch (error) {
    console.error('Error printing report cards:', error);
    alert('Erreur lors de l\'impression des bulletins.');
  } finally {
    showPrintModal.value = false;
  }
};
</script>

<style scoped>
/* Styles */
</style>
