<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { IStudentDetails } from '@/types/student';
import type { IFilterCriteria } from '@/types/shared';
import type { ISchoolData } from '@/types/school';

defineProps<{
  students: IStudentDetails[];
  filterCriteria: IFilterCriteria;
}>();

const schoolInfo = ref<ISchoolData>({
  id: undefined,
  name: '',
  address: '',
  town: '',
  country: 'SN',
  phone: '',
  email: '',
  type: 'publique',
  foundationYear: new Date().getFullYear(),
  logo: null
});

const logoPreview = ref<string>('');

// Charger les informations de l'école
const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result?.success && result.data) {
      schoolInfo.value = {
        ...schoolInfo.value,
        ...result.data
      };
      
      // Charger le logo si présent
      if (schoolInfo.value.logo?.id) {
        await loadLogo(schoolInfo.value.logo);
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des informations:', error);
  }
};

// Charger le logo
const loadLogo = async (logo?: { id: number; name: string; type: string; path?: string; content?: string }) => {
  if (!logo) {
    logoPreview.value = '';
    return;
  }

  try {
    const logoResult = await window.ipcRenderer.invoke('school:getLogo', logo.id);
    if (logoResult.success && logoResult.data) {
      if (logoResult.data.content) {
        logoPreview.value = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
      } else {
        console.error("Le contenu du logo est manquant");
        logoPreview.value = '';
      }
    } else {
      console.error("Erreur lors du chargement du logo:", logoResult.error);
      logoPreview.value = '';
    }
  } catch (error) {
    console.error("Erreur lors du chargement du logo:", error);
    logoPreview.value = '';
  }
};

onMounted(loadSchoolInfo);
</script>

<template>
  <div class="print-template" id="school-print-template">
    <div class="print-header">
      <div class="school-info">
        <div class="logo-container" v-if="logoPreview">
          <img :src="logoPreview" alt="Logo de l'école" class="school-logo" />
        </div>
        <div class="school-details">
          <h1 class="school-name">{{ schoolInfo.name }}</h1>
          <p class="school-address">{{ schoolInfo.address }}</p>
          <p class="school-town">{{ schoolInfo.town }}</p>
          <p class="school-contact">
            Tél: {{ schoolInfo.phone }} | Email: {{ schoolInfo.email }}
          </p>
          <p class="school-type">{{ schoolInfo.type === 'publique' ? 'École Publique' : 'École Privée' }}</p>
        </div>
      </div>

      <div class="document-title">
        <h2>Liste des Élèves</h2>
        <div class="print-info">
          <p v-if="filterCriteria.schoolGrade">Classe : {{ filterCriteria.schoolGrade }}</p>
          <p v-if="filterCriteria.schoolYear">Année scolaire : {{ filterCriteria.schoolYear }}</p>
          <p v-if="filterCriteria.studentFullName">Filtre : {{ filterCriteria.studentFullName }}</p>
        </div>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>N°</th>
          <th>Matricule</th>
          <th>Nom</th>
          <th>Prénom</th>
          <th>Genre</th>
          <th>Date de naissance</th>
          <th>Lieu de naissance</th>
          <th>Contact Parents</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(student, index) in students" :key="student.id">
          <td>{{ index + 1 }}</td>
          <td>{{ student.matricule }}</td>
          <td>{{ student.lastname }}</td>
          <td>{{ student.firstname }}</td>
          <td>{{ student.sex === 'male' ? 'Garçon' : 'Fille' }}</td>
          <td>{{ student.birthDay ? new Date(student.birthDay).toLocaleDateString() : '' }}</td>
          <td>{{ student.birthPlace || '' }}</td>
          <td>{{ student.famillyPhone || '' }}</td>
        </tr>
      </tbody>
    </table>

    <div class="print-footer">
      <p>Date d'impression : {{ new Date().toLocaleDateString() }}</p>
      <p class="footer-note">Document généré par e-school</p>
    </div>
  </div>
</template>

<style scoped>
.print-template {
  padding: 20px;
  font-family: Arial, sans-serif;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.print-header {
  margin-bottom: 30px;
  page-break-inside: avoid;
}

.school-info {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  gap: 20px;
  page-break-inside: avoid;
}

.logo-container {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  page-break-inside: avoid;
}

.school-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.school-details {
  text-align: center;
  page-break-inside: avoid;
}

.school-name {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.school-address,
.school-town,
.school-contact,
.school-type {
  margin: 5px 0;
  color: #666;
  font-size: 14px;
}

.document-title {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #eee;
  page-break-inside: avoid;
}

.document-title h2 {
  font-size: 20px;
  margin-bottom: 10px;
  color: #2c3e50;
}

.print-info {
  font-size: 14px;
  color: #666;
}

.print-info p {
  margin: 5px 0;
}

.print-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
  page-break-inside: auto;
}

.print-table th,
.print-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.print-table th {
  background-color: #f5f5f5 !important;
  font-weight: bold;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.print-table tr:nth-child(even) {
  background-color: #f9f9f9 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.print-footer {
  text-align: right;
  font-size: 12px;
  color: #666;
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 10px;
  page-break-inside: avoid;
}

.footer-note {
  font-style: italic;
  margin-top: 5px;
}

@media print {
  .print-template {
    padding: 0;
    width: 100%;
    height: auto;
  }

  .school-info {
    margin-bottom: 15px;
    display: flex !important;
  }

  .logo-container {
    width: 80px;
    height: 80px;
    display: flex !important;
  }

  .school-logo {
    display: block !important;
    visibility: visible !important;
  }

  .school-name {
    font-size: 20px;
  }

  .school-address,
  .school-town,
  .school-contact,
  .school-type {
    font-size: 12px;
  }

  .document-title h2 {
    font-size: 18px;
  }

  .print-table {
    width: 100% !important;
    display: table !important;
  }

  .print-table th,
  .print-table td {
    padding: 6px;
    font-size: 12px;
    border: 1px solid #000 !important;
  }

  .print-info {
    font-size: 12px;
  }

  .print-footer {
    font-size: 10px;
  }

  /* Forcer l'affichage des éléments */
  .print-header,
  .school-info,
  .school-details,
  .document-title,
  .print-table,
  .print-footer {
    display: block !important;
    visibility: visible !important;
  }
}
</style> 