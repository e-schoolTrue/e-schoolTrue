<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';

interface StudentDetails {
  id: number;
  lastname: string;
  firstname: string;
  matricule: string;
  birthDay: Date | null;
  birthPlace: string;
  address: string;
  classId: number | null;
  fatherFirstname: string;
  fatherLastname: string;
  motherFirstname: string;
  motherLastname: string;
  famillyPhone: string;
  personalPhone: string;
  sex: 'male' | 'female';
  schoolYear: string;
  photo?: { id: number; name: string };
  documents?: Array<{ id: number; name: string; type: string }>;
}

const route = useRoute();
const studentDetails = ref<StudentDetails | null>(null);
const photoUrl = ref<string | null>(null);
const activeNames = ref(['1', '2', '3', '4', '5', '6']);

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
  createElement(arg0: string): HTMLAnchorElement; id: number; name: string; type: string 
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
</script>

<template>
  <el-container>
    <el-aside width="200px">
      <el-card class="h-100">
        <el-row justify="center">
          <el-text size="large" class="vertical-text">
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
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Informations parentales" name="2">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Nom du père">{{ studentDetails.fatherLastname }}</el-descriptions-item>
              <el-descriptions-item label="Prénom du père">{{ studentDetails.fatherFirstname }}</el-descriptions-item>
              <el-descriptions-item label="Nom de la mère">{{ studentDetails.motherLastname }}</el-descriptions-item>
              <el-descriptions-item label="Prénom de la mère">{{ studentDetails.motherFirstname }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Informations scolaires" name="4">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Année Scolaire">{{ studentDetails.schoolYear }}</el-descriptions-item>
              <el-descriptions-item label="Classe">{{ studentDetails.classId }}</el-descriptions-item>
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

.vertical-text {
  font-weight: bold;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
}
</style>
