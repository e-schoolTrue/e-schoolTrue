<script setup lang="ts">
//studentDetail
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElDialog } from 'element-plus';
import { View, Download, Back } from '@element-plus/icons-vue';
import type { IStudentDetails, IStudentFile } from '@/types/student';
import type { IGrade } from '@/types/shared';



interface CurrentDocument {
  id?: number;
  content?: string;
  type?: string;
  name?: string;
}

const route = useRoute();
const router = useRouter();
const studentDetails = ref<IStudentDetails | null>(null);
const photoUrl = ref<string | null>(null);
const activeNames = ref(['1', '2', '3', '4', '6']);
const dialogVisible = ref(false);
const currentDocument = ref<CurrentDocument | null>(null);

const getClassName = (grade?: IGrade | null) => {
  if (!grade) return "Non assigné";
  return grade.name || "Non assigné";
};

const formatDate = (dateString: string | Date | null | undefined) => {
  if (!dateString) return 'Non spécifié';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Date invalide';
  }
};

const loadPhoto = async (photo?: IStudentFile | null) => {
  if (!photo) {
    photoUrl.value = null;
    return;
  }

  try {
    const photoResult = await window.ipcRenderer.invoke('getStudentPhoto', photo.id);
    console.log("Photo de l'étudiant:", photoResult);
    if (photoResult.success && photoResult.data) {
      photoUrl.value = `data:${photoResult.data.type};base64,${photoResult.data.content}`;
    } else {
      console.error("Erreur lors du chargement de la photo:", photoResult.error);
      photoUrl.value = null;
    }
  } catch (error) {
    console.error("Erreur lors du chargement de la photo:", error);
    photoUrl.value = null;
  }
};

onMounted(async () => {
  const studentId = route.params.id;
  if (studentId) {
    try {
      const result = await window.ipcRenderer.invoke('student:getDetails', Number(studentId));
      console.log("Données reçues:", result);
      
      if (result.success) {
        studentDetails.value = result.data;
        await loadPhoto(studentDetails.value?.photo);
      } else {
        ElMessage.error("Erreur lors de la récupération des détails de l'étudiant");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des détails de l'étudiant:", error);
      ElMessage.error("Une erreur s'est produite lors du chargement des détails");
    }
  }
});

const downloadDocument = async (document: IStudentFile) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', document.id);
    console.log("Document à télécharger:", result);
    if (result.success && result.data && result.data.content) {
      try {
        const byteCharacters = atob(result.data.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.type });
        
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = document.name;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Erreur de décodage:", error);
        ElMessage.error("Erreur lors du décodage du document");
      }
    } else {
      ElMessage.error("Erreur lors du téléchargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du téléchargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du téléchargement du document");
  }
};

const viewDocument = async (document: IStudentFile) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', document.id);
    if (result.success && result.data && result.data.content) {
      const content = `data:${result.data.type};base64,${result.data.content}`;

      currentDocument.value = {
        id: document.id,
        content: content,
        type: result.data.type,
        name: document.name
      };

      console.log("Document à afficher:", {
        type: currentDocument.value.type,
        name: currentDocument.value.name,
        contentLength: currentDocument.value.content?.length
      });

      dialogVisible.value = true;
    } else {
      ElMessage.error("Erreur lors du chargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du chargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement du document");
  }
};
</script>

<template>
  <div class="details-container">
    <div class="navigation-bar">
      <el-button 
        type="primary" 
        plain
        @click="router.push({ name: 'StudentList' })"
        class="back-button"
      >
        <el-icon><Back /></el-icon>
        Retour à la liste
      </el-button>
    </div>
    
    <el-card v-if="studentDetails" class="details-card">
      <!-- En-tête avec photo et infos principales -->
      <div class="header-section">
        <div class="photo-container">
          <el-image 
            v-if="photoUrl" 
            :src="photoUrl" 
            fit="cover" 
            class="student-photo"
            :preview-src-list="photoUrl ? [photoUrl] : []"
            @error="(e: any) => {
              console.error('Erreur de chargement de l\'image:', e);
              console.log('URL de l\'image:', photoUrl);
            }"
          >
            <template #error>
              <div class="image-slot">
                <el-icon><i-mdi-image-broken /></el-icon>
                <span>Erreur de chargement</span>
                <small>{{ photoUrl ? 'URL invalide' : 'Pas d\'URL' }}</small>
              </div>
            </template>
          </el-image>
          <el-empty v-else description="Pas de photo" :image-size="100">
            <template #image>
              <el-icon :size="60"><i-mdi-account-circle /></el-icon>
            </template>
          </el-empty>
        </div>

        <div class="main-info">
          <h2>{{ studentDetails.firstname }} {{ studentDetails.lastname }}</h2>
          <p>Matricule: {{ studentDetails.matricule }}</p>
          <p>Année scolaire: {{ studentDetails.schoolYear }}</p>
        </div>
      </div>

      <!-- Section des détails -->
      <div class="details-section">
        <el-collapse v-model="activeNames">
          <el-collapse-item title="Informations personnelles" name="1">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="Date de naissance">{{ formatDate(studentDetails.birthDay) }}</el-descriptions-item>
              <el-descriptions-item label="Lieu de naissance">{{ studentDetails.birthPlace }}</el-descriptions-item>
              <el-descriptions-item label="Adresse">{{ studentDetails.address }}</el-descriptions-item>
              <el-descriptions-item label="Téléphone personnel">{{ studentDetails.personalPhone || 'Non spécifié' }}</el-descriptions-item>
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
              <el-descriptions-item label="Classe">{{ getClassName(studentDetails.grade) }}</el-descriptions-item>
            </el-descriptions>
          </el-collapse-item>

          <el-collapse-item title="Documents" name="6">
            <el-table 
              v-if="studentDetails?.documents?.length" 
              :data="studentDetails.documents"
              :max-height="200"
            >
              <el-table-column prop="name" label="Nom du document"></el-table-column>
              <el-table-column prop="type" label="Type"></el-table-column>
              <el-table-column label="Actions" width="150">
                <template #default="scope">
                  <el-button-group>
                    <el-button 
                      size="small" 
                      type="primary"
                      @click="viewDocument(scope.row)"
                      :icon="View"
                      title="Voir le document"
                    />
                    <el-button 
                      size="small" 
                      type="success"
                      @click="downloadDocument(scope.row)"
                      :icon="Download"
                      title="Télécharger"
                    />
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="Aucun document disponible"></el-empty>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>
    <el-empty v-else description="Aucune donnée disponible"></el-empty>

    <el-dialog
      v-model="dialogVisible"
      :title="currentDocument?.name"
      width="80%"
      :fullscreen="true"
      destroy-on-close
    >
      <div class="document-viewer">
        <template v-if="currentDocument?.type?.includes('pdf')">
          <object
            :data="currentDocument.content"
            type="application/pdf"
            width="100%"
            height="100%"
          >
            <p>Ce navigateur ne supporte pas l'affichage des PDF.</p>
          </object>
        </template>
        <template v-else-if="currentDocument?.type?.includes('image')">
          <img
            :src="currentDocument.content"
            style="max-width: 100%; max-height: 100%; object-fit: contain;"
          />
        </template>
        <template v-else>
          <div class="unsupported-format">
            <el-icon :size="48"><i-mdi-file-document-outline /></el-icon>
            <p>Ce type de document ne peut pas être prévisualisé</p>
            <el-button 
              type="primary" 
              @click="currentDocument?.id ? downloadDocument({
                id: currentDocument.id,
                name: currentDocument.name || '',
                type: currentDocument.type || ''
              }) : undefined"
              :disabled="!currentDocument?.id"
            >
              Télécharger le document
            </el-button>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.details-container {
  padding: 20px;
  height: 100%;
  max-height: 100vh;
  box-sizing: border-box;
}

.navigation-bar {
  margin-bottom: 20px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 5px;
}

.details-card {
  height: calc(100% - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-section {
  display: flex;
  gap: 20px;
  padding-bottom: 20px;
  flex-shrink: 0;
}

.photo-container {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f5f7fa;
}

.main-info {
  flex-grow: 1;
}

.details-section {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 5px;
}

/* Personnalisation de la scrollbar pour la rendre plus discrète */
.details-section::-webkit-scrollbar {
  width: 6px;
}

.details-section::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.details-section::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.details-section::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.student-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.el-collapse {
  border: none;
}

h2 {
  margin-top: 0;
  color: var(--el-text-color-primary);
}

/* Ajustements pour les descriptions */
:deep(.el-descriptions) {
  margin-bottom: 15px;
}

:deep(.el-collapse-item__wrap) {
  padding: 10px 0;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.image-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
  background-color: #f5f7fa;
  padding: 10px;
}

.image-slot .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.image-slot small {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.document-viewer {
  width: 100%;
  height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: auto;
  padding: 20px;
}

.unsupported-format {
  text-align: center;
  padding: 2rem;
}

.unsupported-format .el-icon {
  margin-bottom: 1rem;
  color: #909399;
}

:deep(.el-dialog__body) {
  padding: 0;
  margin: 10px;
}

:deep(.el-dialog__header) {
  margin-right: 0;
  padding: 10px;
}
</style>