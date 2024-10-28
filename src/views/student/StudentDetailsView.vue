<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

interface StudentDetails {
  id: number;
  lastname: string;
  firstname: string;
  matricule: string;
  schoolYear: string;
  birthDay: string;
  birthPlace: string;
  address: string;
  personalPhone: string;
  famillyPhone: string;
  sex: 'male' | 'female';
  nationality: string;
  fatherFirstname: string;
  fatherLastname: string;
  fatherProfession: string;
  fatherEmail: string;
  motherFirstname: string;
  motherLastname: string;
  motherProfession: string;
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
  photo?: { id: number; name: string };
  documents?: Array<{ id: number; name: string; type: string }>;
  payments?: Array<{ id: number; name: string; type: string }>;
  absences?: Array<{ id: number; name: string; type: string }>;
}

const route = useRoute();
const studentDetails = ref<StudentDetails | null>(null);
const photoUrl = ref<string | null>(null);

onMounted(async () => {
  const studentId = route.params.id;
  if (studentId) {
    try {
      const result = await window.ipcRenderer.invoke('student:getDetails', Number(studentId));
      if (result.success) {
        studentDetails.value = result.data as StudentDetails;
        if (studentDetails.value.photo) {
          const photoResult = await window.ipcRenderer.invoke('getStudentPhoto', studentDetails.value.photo.id);
          if (photoResult.success) {
            const blob = new Blob([photoResult.data.content], { type: photoResult.data.type });
            photoUrl.value = URL.createObjectURL(blob);
          }
        }
      } else {
        ElMessage.error("Erreur lors de la récupération des détails de l'étudiant");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des détails de l'étudiant:", error);
      ElMessage.error("Une erreur s'est produite lors du chargement des détails");
    }
  }
});

const downloadDocument = async (document: {
  body: any;
  createElement(arg0: string): unknown; id: number; name: string; type: string 
}) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', document.id);
    if (result.success) {
      const blob = new Blob([result.data.content], { type: result.data.type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a') as HTMLAnchorElement;
      a.href = url;
      a.download = document.name;
      document.body?.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      ElMessage.error("Erreur lors du téléchargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du téléchargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du téléchargement du document");
  }
};

const activeNames = ref(['1', '2', '3', '4', '5', '6']); // Tous les panneaux ouverts par défaut
</script>

<template>
  <el-container>
    <el-aside width="200px">
      <el-card class="h-100">
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold; writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);">
            Détails de l'étudiant
          </el-text>
        </el-row>
      </el-card>
    </el-aside>
    
    <el-main>
      <el-card v-if="studentDetails" class="h-100">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-image v-if="photoUrl" :src="photoUrl" fit="cover" class="student-photo" />
            <el-empty v-else description="Pas de photo" :image-size="100">
              <template #image>
                <el-icon :size="60"><i-mdi-account-circle /></el-icon>
              </template>
            </el-empty>
          </el-col>
          
          <el-col :span="18">
            <h2>{{ studentDetails.firstname }} {{ studentDetails.lastname }}</h2>
            <p>Matricule: {{ studentDetails.matricule }}</p>
            <p>Année scolaire: {{ studentDetails.schoolYear }}</p>
          </el-col>
        </el-row>

        <el-collapse v-model="activeNames">
          <el-collapse-item title="Informations personnelles" name="1">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Date de naissance">{{ studentDetails.birthDay }}</el-descriptions-item>
              <el-descriptions-item label="Lieu de naissance">{{ studentDetails.birthPlace }}</el-descriptions-item>
              <el-descriptions-item label="Adresse">{{ studentDetails.address }}</el-descriptions-item>
              <el-descriptions-item label="Téléphone personnel">{{ studentDetails.personalPhone }}</el-descriptions-item>
              <el-descriptions-item label="Téléphone familial">{{ studentDetails.famillyPhone }}</el-descriptions-item>
              <el-descriptions-item label="Sexe">{{ studentDetails.sex === 'male' ? 'Masculin' : 'Féminin' }}</el-descriptions-item>
              <el-descriptions-item label="Nationalité">{{ studentDetails.nationality }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Informations parentales" name="2">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Nom du père">{{ studentDetails.fatherLastname }}</el-descriptions-item>
              <el-descriptions-item label="Prénom du père">{{ studentDetails.fatherFirstname }}</el-descriptions-item>
              <el-descriptions-item label="Profession du père">{{ studentDetails.fatherProfession }}</el-descriptions-item>
              <el-descriptions-item label="Email du père">{{ studentDetails.fatherEmail }}</el-descriptions-item>
              <el-descriptions-item label="Nom de la mère">{{ studentDetails.motherLastname }}</el-descriptions-item>
              <el-descriptions-item label="Prénom de la mère">{{ studentDetails.motherFirstname }}</el-descriptions-item>
              <el-descriptions-item label="Profession de la mère">{{ studentDetails.motherProfession }}</el-descriptions-item>
              <el-descriptions-item label="Email de la mère">{{ studentDetails.motherEmail }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Informations médicales" name="3">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Groupe sanguin">{{ studentDetails.bloodGroup }}</el-descriptions-item>
              <el-descriptions-item label="Allergies">{{ studentDetails.allergies }}</el-descriptions-item>
              <el-descriptions-item label="Conditions médicales">{{ studentDetails.medicalConditions }}</el-descriptions-item>
              <el-descriptions-item label="Nom du médecin">{{ studentDetails.doctorName }}</el-descriptions-item>
              <el-descriptions-item label="Téléphone du médecin">{{ studentDetails.doctorPhone }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Informations scolaires" name="4">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Dernière école">{{ studentDetails.lastSchool }}</el-descriptions-item>
              <el-descriptions-item label="Dernière classe">{{ studentDetails.lastClass }}</el-descriptions-item>
              <el-descriptions-item label="Raison du changement">{{ studentDetails.changeReason }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Frais et consentements" name="5">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Frais d'inscription">{{ studentDetails.inscriptionFees }}</el-descriptions-item>
              <el-descriptions-item label="Frais annuels">{{ studentDetails.annualFees }}</el-descriptions-item>
              <el-descriptions-item label="Frais de bus">{{ studentDetails.busFees }}</el-descriptions-item>
              <el-descriptions-item label="Frais de cantine">{{ studentDetails.canteenFees }}</el-descriptions-item>
              <el-descriptions-item label="Mode de paiement">{{ studentDetails.paymentMode }}</el-descriptions-item>
              <el-descriptions-item label="Consentement d'urgence">{{ studentDetails.emergencyConsent ? 'Oui' : 'Non' }}</el-descriptions-item>
              <el-descriptions-item label="Acceptation des règles">{{ studentDetails.rulesConsent ? 'Oui' : 'Non' }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Documents" name="6">
            <el-table v-if="studentDetails.documents && studentDetails.documents.length > 0" :data="studentDetails.documents">
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
          </el-collapse-item>

          <div v-if="studentDetails.payments && studentDetails.payments.length > 0">
            <!-- Affichage des paiements -->
          </div>
          <div v-if="studentDetails.absences && studentDetails.absences.length > 0">
            <!-- Affichage des absences -->
          </div>
        </el-collapse>
      </el-card>
      <el-empty v-else description="Aucune donnée disponible"></el-empty>
    </el-main>
  </el-container>
</template>

<style scoped>
.el-container {
  height: calc(100vh - 60px); /* Ajustez selon la hauteur de votre en-tête */
}

.el-aside {
  background-color: #f0f2f5;
}

.el-main {
  padding: 20px;
}

.h-100 {
  height: 100%;
}

.student-photo {
  width: 200px;
  height: 200px;
  object-fit: cover;
  border-radius: 50%;
}

.el-collapse {
  margin-top: 20px;
}
</style>