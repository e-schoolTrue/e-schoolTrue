<template>
  <el-card v-if="student" class="student-card">
    <el-row :gutter="20">
      <!-- Photo de l'étudiant -->
      <el-col :span="8" class="photo-column">
        <el-image
          v-if="student.photo && photoUrl"
          :src="photoUrl"
          fit="cover"
          class="student-photo"
        >
          <template #error>
            <div class="image-slot">
              <el-icon :size="60"><i-mdi-account-circle /></el-icon>
            </div>
          </template>
        </el-image>
        <el-empty v-else description="Pas de photo" :image-size="100">
          <template #image>
            <el-icon :size="60"><i-mdi-account-circle /></el-icon>
          </template>
        </el-empty>
      </el-col>

      <!-- Informations de base de l'étudiant -->
      <el-col :span="16">
        <h2 class="student-name">{{ student.firstname }} {{ student.lastname }}</h2>
        <p class="student-matricule">
          <el-icon><i-mdi-identifier /></el-icon>
          Matricule: {{ student.matricule }}
        </p>

        <el-divider />

        <h3>Informations Personnelles</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <p><el-icon><i-mdi-calendar /></el-icon> Né(e) le: {{ formatDate(student.birthDay) }}</p>
            <p><el-icon><i-mdi-map-marker /></el-icon> Lieu: {{ student.birthPlace }}</p>
            <p><el-icon><i-mdi-home /></el-icon> Adresse: {{ student.address }}</p>
          </el-col>
          <el-col :span="12">
            <p><el-icon><i-mdi-phone /></el-icon> Tél: {{ student.personalPhone }}</p>
            <p><el-icon><i-mdi-school /></el-icon> Classe: {{ student.className }}</p>
            <p><el-icon><User /></el-icon> Sexe: {{ student.sex === 'male' ? 'Masculin' : 'Féminin' }}</p>
            <p><el-icon><Calendar /></el-icon> Année scolaire: {{ student.schoolYear }}</p>
          </el-col>
        </el-row>

        <el-divider />

        <h3>Informations des Parents</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <p><el-icon><i-mdi-account /></el-icon> Père: {{ student.fatherFirstname }} {{ student.fatherLastname }}</p>
          </el-col>
          <el-col :span="12">
            <p><el-icon><i-mdi-account /></el-icon> Mère: {{ student.motherFirstname }} {{ student.motherLastname }}</p>
          </el-col>
        </el-row>
        <p><el-icon><i-mdi-phone /></el-icon> Tél. familial: {{ student.famillyPhone }}</p>

        <el-button @click="showMore = !showMore" type="primary" class="mt-4">
          {{ showMore ? 'Voir moins' : 'Voir plus' }}
        </el-button>
      </el-col>
    </el-row>

    <!-- Informations supplémentaires (affichées lorsque "Voir plus" est cliqué) -->
    <el-collapse-transition>
      <div v-if="showMore">
        <el-divider />

        <h3>Informations Médicales</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <p><el-icon><i-mdi-water /></el-icon> Groupe sanguin: {{ student.bloodGroup || 'Non spécifié' }}</p>
            <p><el-icon><i-mdi-alert-circle /></el-icon> Allergies: {{ student.allergies || 'Aucune' }}</p>
          </el-col>
          <el-col :span="12">
            <p><el-icon><i-mdi-medical-bag /></el-icon> Conditions médicales: {{ student.medicalConditions || 'Aucune' }}</p>
            <p><el-icon><i-mdi-doctor /></el-icon> Médecin traitant: {{ student.doctorName || 'Non spécifié' }}</p>
            <p><el-icon><i-mdi-phone /></el-icon> Tél. médecin: {{ student.doctorPhone || 'Non spécifié' }}</p>
          </el-col>
        </el-row>

        <el-divider />

        <h3>Informations Scolaires</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <p><el-icon><i-mdi-school /></el-icon> Dernière école: {{ student.lastSchool || 'Non spécifié' }}</p>
            <p><el-icon><i-mdi-book-open-variant /></el-icon> Dernière classe: {{ student.lastClass || 'Non spécifié' }}</p>
          </el-col>
          <el-col :span="12">
            <p><el-icon><i-mdi-comment-text /></el-icon> Motif du changement: {{ student.changeReason || 'Non spécifié' }}</p>
          </el-col>
        </el-row>

        <el-divider />

        <h3>Frais et Consentements</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <p><el-icon><i-mdi-cash /></el-icon> Frais d'inscription: {{ student.inscriptionFees || 0 }}</p>
            <p><el-icon><i-mdi-cash-multiple /></el-icon> Frais annuels: {{ student.annualFees || 0 }}</p>
          </el-col>
          <el-col :span="12">
            <p><el-icon><i-mdi-bus /></el-icon> Frais de bus: {{ student.busFees || 0 }}</p>
            <p><el-icon><i-mdi-food /></el-icon> Frais de cantine: {{ student.canteenFees || 0 }}</p>
          </el-col>
        </el-row>
        <p><el-icon><i-mdi-cash-register /></el-icon> Mode de paiement: {{ student.paymentMode || 'Non spécifié' }}</p>
        <p><el-icon><i-mdi-check-circle /></el-icon> Consentement d'urgence: {{ student.emergencyConsent ? 'Oui' : 'Non' }}</p>
        <p><el-icon><i-mdi-check-circle /></el-icon> Acceptation des règles: {{ student.rulesConsent ? 'Oui' : 'Non' }}</p>

        <!-- Section Documents -->
        <el-divider />
        <h3>Documents</h3>
        <el-table v-if="student.documents && student.documents.length > 0" :data="student.documents" style="width: 100%">
          <el-table-column prop="name" label="Nom du document"></el-table-column>
          <el-table-column prop="type" label="Type"></el-table-column>
          <el-table-column label="Actions" width="120">
            <template #default="scope">
              <el-button size="small" @click="downloadDocument(scope.row)" type="primary">
                <el-icon><i-mdi-download /></el-icon> Télécharger
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="Aucun document disponible"></el-empty>
      </div>
    </el-collapse-transition>
  </el-card>
  <el-card v-else>
    <el-empty description="Aucune donnée d'étudiant disponible"></el-empty>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { User, Calendar } from '@element-plus/icons-vue';

interface StudentDetail {
  id: number;
  matricule: string;
  lastname: string;
  firstname: string;
  birthDay: string;
  birthPlace: string;
  address: string;
  personalPhone: string;
  fatherFirstname: string;
  fatherLastname: string;
  motherFirstname: string;
  motherLastname: string;
  famillyPhone: string;
  className?: string;
  photo?: { id: number; name: string } | null;
  documents?: Array<{ id: number; name: string; type: string }>;
  sex: 'male' | 'female';
  schoolYear: string;
  nationality: string;
  fatherProfession: string;
  fatherPhone: string;
  fatherEmail: string;
  motherProfession: string;
  motherPhone: string;
  motherEmail: string;
  bloodGroup: string;
  allergies: string;
  medicalConditions: string;
  doctorName: string;
  doctorPhone: string;
  lastSchool: string;
  lastClass: string;
  changeReason: string;
  inscriptionFees: number;
  annualFees: number;
  busFees: number;
  canteenFees: number;
  paymentMode: string;
  emergencyConsent: boolean;
  rulesConsent: boolean;
}

const props = defineProps<{
  studentId: number;
}>();

const student = ref<StudentDetail | null>(null);
const photoUrl = ref('');
const showMore = ref(false);

const loadStudentDetails = async () => {
  if (!props.studentId) return;
  
  try {
    console.log("Chargement des détails pour l'étudiant ID:", props.studentId);
    const result = await window.ipcRenderer.invoke('student:getDetails', props.studentId);
    console.log("Résultat brut de student:getDetails:", result);
    if (result.success) {
      student.value = result.data;
      console.log("Données de l'étudiant chargées et assignées:", student.value);
      if (student.value?.photo) {
        const photoResult = await window.ipcRenderer.invoke('getStudentPhoto', student.value.photo.id);
        if (photoResult.success) {
          const blob = new Blob([photoResult.data.content], { type: photoResult.data.type });
          photoUrl.value = URL.createObjectURL(blob);
        }
      }
    } else {
      console.error("Erreur lors du chargement des détails:", result.message);
      console.error("Stack trace:", result.error);
      ElMessage.error(`Erreur lors du chargement des détails de l'étudiant: ${result.message}`);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des détails de l\'étudiant:', error);
    ElMessage.error('Une erreur s\'est produite lors du chargement des détails.');
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const downloadDocument = async (document: { id: number; name: string; type: string }) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', document.id);
    if (result.success) {
      const blob = new Blob([result.data.content], { type: result.data.type });
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.name}.${result.data.extension}`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      ElMessage.success('Document téléchargé avec succès');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement du document:', error);
    ElMessage.error('Une erreur s\'est produite lors du téléchargement du document.');
  }
};

onMounted(() => {
  console.log("Composant monté, studentId:", props.studentId);
  loadStudentDetails();
});

watch(() => props.studentId, (newId) => {
  console.log("studentId changé:", newId);
  loadStudentDetails();
});

</script>

<style scoped>
.student-card {
  margin-bottom: 20px;
  background-color: #ffffff;
  border: 1px solid #003366;
}
.student-name {
  margin-bottom: 5px;
  color: #003366;
}
.student-matricule {
  color: #1e8f4c;
  font-size: 1.1em;
}
.photo-column {
  display: flex;
  justify-content: center;
  align-items: start;
}
.student-photo {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #003366;
}
.el-icon {
  margin-right: 8px;
  vertical-align: middle;
  color: #1e8f4c;
}
h3 {
  color: #003366;
  margin-top: 20px;
}
p {
  margin: 10px 0;
  color: #333;
}
.el-divider {
  background-color: #1e8f4c;
}
.el-button {
  background-color: #1e8f4c;
  border-color: #1e8f4c;
  color: white;
}
.el-button:hover {
  background-color: #17723d;
  border-color: #17723d;
}
/* Ajout de styles pour améliorer la lisibilité et l'harmonie */
.el-card {
  box-shadow: 0 2px 12px 0 rgba(0, 51, 102, 0.1);
}
.el-table {
  border: 1px solid #003366;
}
.el-table th {
  background-color: #003366;
  color: white;
}
.el-table td {
  border-bottom: 1px solid #e0e0e0;
}
/* Style pour les liens et les éléments interactifs */
a, .el-button--text {
  color: #1e8f4c;
}
a:hover, .el-button--text:hover {
  color: #17723d;
}

.mt-4 {
  margin-top: 1rem;
}
</style>