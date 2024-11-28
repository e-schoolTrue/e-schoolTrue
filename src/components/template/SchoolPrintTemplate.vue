<template>
  <div class="print-page" ref="printContainer" id="school-print-template">
    <div class="print-content">
      <!-- En-tête République -->
      <div class="republic-header">
        <h3>RÉPUBLIQUE DE GUINÉE</h3>
        <p>TRAVAIL - JUSTICE - SOLIDARITÉ</p>
      </div>

      <!-- En-tête école -->
      <div class="header">
        <div class="header-left">
          <h3>{{ schoolInfo.name }}</h3>
          <p>Année scolaire: {{ currentSchoolYear }}</p>
          <p v-if="filterInfoText" class="filter-info">{{ filterInfoText }}</p>
          <p v-if="gradeName">Classe : {{ gradeName }}</p>
        </div>
        <div class="header-center">
          <img
            v-if="schoolInfo.logo"
            :src="`data:${schoolInfo.logo.type};base64,${schoolInfo.logo.content}`"
            class="school-logo"
            alt="Logo école"
          />
        </div>
        <div class="header-right">
          <p>{{ schoolInfo.address }}</p>
          <p>Tel: {{ schoolInfo.phoneNumber }}</p>
        </div>
      </div>

      <!-- Titre du document -->
      <div class="document-header">
        <h2 class="document-title">
          Liste des élèves 
          {{ filterInfoText ? `(${filterInfoText})` : '' }}
        </h2>
      </div>

      <!-- Tableau des élèves -->
      <div class="dynamic-content">
        <table class="generic-table">
          <thead>
            <tr>
              <th>Matricule</th>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Année scolaire</th>
              <th v-if="showClassColumn">Classe</th>
              <th>Téléphone famille</th>
              <th>Sexe</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.id">
              <td>{{ student.matricule }}</td>
              <td>{{ student.lastname }}</td>
              <td>{{ student.firstname }}</td>
              <td>{{ student.schoolYear }}</td>
              <td v-if="showClassColumn">{{ student.gradeId || '-' }}</td>
              <td>{{ student.famillyPhone || '-' }}</td>
              <td>{{ student.sex || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pied de page -->
      <div class="footer">
        <p>Document généré le {{ formatDate(new Date()) }}</p>
        <p>Total élèves : {{ students.length }}</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType, onMounted, computed } from 'vue';

interface Student {
  id?: number;
  firstname: string;
  lastname: string;
  matricule: string;
  schoolYear: string;
  gradeId?: number;
  famillyPhone?: string;
  sex: "male" | "female";
}

interface Logo {
  type: string;
  content: string;
}

interface SchoolInfo {
  name: string;
  logo: Logo | null;
  address: string;
  phoneNumber: string;
}

interface FilterCriteria {
  studentFullName?: string;
  schoolGrade?: string;
  schoolYear?: string;
}

export default defineComponent({
  name: 'StudentListPrintTemplate',

  props: {
    students: {
      type: Array as PropType<Student[]>,
      required: true,
      default: () => []
    },
    filterCriteria: {
      type: Object as PropType<FilterCriteria>,
      default: () => ({})
    }
  },

  setup(props) {
    const printContainer = ref<HTMLElement | null>(null);
    const schoolInfo = ref<SchoolInfo>({
      name: '',
      logo: null,
      address: '',
      phoneNumber: '',
    });
    const currentSchoolYear = ref('');

    const loadSchoolInfo = async () => {
      try {
        const result = await window.ipcRenderer.invoke('school:get');
        if (result.success && result.data) {
          schoolInfo.value = result.data;
        }
      } catch (error) {
        console.error(
          "Erreur lors du chargement des informations de l'école:",
          error
        );
      }
    };

    const getCurrentSchoolYear = () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    };

    const formatDate = (date: Date): string => {
      return new Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    // Calcul du texte des filtres
    const filterInfoText = computed(() => {
      const { studentFullName, schoolGrade, schoolYear } = props.filterCriteria;
      const filters = [];
      
      if (studentFullName) filters.push(`Nom: ${studentFullName}`);
      if (schoolGrade) filters.push(`Classe: ${schoolGrade}`);
      if (schoolYear) filters.push(`Année: ${schoolYear}`);

      return filters.length > 0 ? filters.join(', ') : '';
    });

    // Calcul du nom de la classe
    const gradeName = computed(() => {
      // Si un critère de classe est spécifié, utilisez-le directement
      if (props.filterCriteria?.schoolGrade) {
        return props.filterCriteria.schoolGrade;
      }
      
      // Si les étudiants ont tous la même classe
      const firstGradeId = props.students[0]?.gradeId;
      const allSameGrade = props.students.every(student => student.gradeId === firstGradeId);
      
      if (allSameGrade && firstGradeId) {
        return `Classe ${firstGradeId}`;
      }
      
      // Sinon, retournez une valeur par défaut
      return 'Toutes classes';
    });

    // Décider si la colonne de classe doit être affichée
    const showClassColumn = computed(() => {
      // Montrer la colonne si aucun filtre de classe n'est appliqué
      return !props.filterCriteria?.schoolGrade;
    });

    onMounted(async () => {
      await loadSchoolInfo();
      currentSchoolYear.value = getCurrentSchoolYear();
    });

    return {
      printContainer,
      schoolInfo,
      currentSchoolYear,
      formatDate,
      filterInfoText,
      gradeName,
      showClassColumn
    };
  },
});
</script>

<style scoped>
.print-page {
  width: 210mm;
  min-height: 297mm;
  padding: 20mm;
  margin: 0 auto;
  background: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  position: relative;
}

.republic-header {
  text-align: center;
  margin-bottom: 20px;
}

.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 2px solid #333;
  padding-bottom: 15px;
}

.header-left {
  text-align: left;
}

.header-center {
  text-align: center;
}

.header-right {
  text-align: right;
}

.school-logo {
  max-height: 80px;
  width: auto;
}

.document-header {
  text-align: center;
  margin: 20px 0;
}

.document-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.generic-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.generic-table th,
.generic-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.generic-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.generic-table tr:nth-child(even) {
  background-color: #fafafa;
}

.footer {
  position: absolute;
  bottom: 20mm;
  width: calc(100% - 40mm);
  text-align: center;
  font-size: 12px;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}

@media print {
  .print-page {
    width: 100%;
    min-height: auto;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }

  @page {
    size: A4;
    margin: 20mm;
  }
}
</style>