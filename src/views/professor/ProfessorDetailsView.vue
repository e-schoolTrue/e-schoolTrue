<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { CIVILITY, FAMILY_SITUATION, SCHOOL_TYPE } from "#electron/command";
import { View, Download } from '@element-plus/icons-vue';

interface Teaching {
  teachingType: 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
  class?: {
    id: number;
    name: string;
  };
  course?: {
    id: number;
    name: string;
  };
  gradeIds?: string;
  gradeNames?: string;
  schoolType: SCHOOL_TYPE;
}

interface Professor {
  id?: number;
  firstname: string;
  lastname: string;
  civility: CIVILITY;
  nbr_child: number;
  family_situation: FAMILY_SITUATION;
  birth_date: Date | null;
  birth_town: string;
  address: string;
  town: string;
  cni_number: string;
  diploma?: {
    name: string;
  };
  qualification?: {
    name: string;
  };
  photo?: { id: number; name: string; type: string };
  documents?: Array<{
    id: number;
    name: string;
    type: string;
  }>;
  teaching?: Teaching[];
}

interface DocumentData {
  id: number;
  name: string;
  type: string;
  content?: string;
}

interface CurrentDocument {
  id?: number;
  content?: string;
  type?: string;
  name?: string;
}

const route = useRoute();
const router = useRouter();
const professor = ref<Professor | null>(null);
const loading = ref(false);
const dialogVisible = ref(false);

const currentDocument = ref<CurrentDocument | null>(null);

const photoUrl = ref<string | null>(null);

const loadPhoto = async (photo?: { id: number; name: string; type: string }) => {
  if (!photo) {
    photoUrl.value = null;
    return;
  }

  try {
    const photoResult = await window.ipcRenderer.invoke('getProfessorPhoto', photo.id); 
    console.log("photo prof :", photoResult)
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
const viewDocument = async (document: DocumentData) => {
  try {
    const result = await window.ipcRenderer.invoke('professor:downloadDocument', document.id);
    if (result.success && result.data && result.data.content) {
      const content = `data:${result.data.type};base64,${result.data.content}`;

      currentDocument.value = {
        id: document.id,
        content: content,
        type: result.data.type,
        name: document.name
      };

      dialogVisible.value = true;
    } else {
      ElMessage.error("Erreur lors du chargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du chargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement du document");
  }
};

const downloadDocument = async (document: DocumentData) => {
  try {
    const result = await window.ipcRenderer.invoke('professor:downloadDocument', document.id);
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

const loadProfessor = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:getById', Number(route.params.id));
    console.log("données :", result)
    if (result.success) {
      professor.value = result.data; // Cette ligne manque
      await loadPhoto(professor.value?.photo);}
      else {
        ElMessage.error("Erreur lors de la récupération des détails de l'étudiant");
      }
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    loading.value = false;
  }
};

const getCivilityLabel = (civility: CIVILITY) => {
  const labels = {
    [CIVILITY.MR]: 'Monsieur',
    [CIVILITY.MME]: 'Madame',
    [CIVILITY.MLLE]: 'Mademoiselle'
  };
  return labels[civility] || civility;
};

const getFamilySituationLabel = (situation: FAMILY_SITUATION) => {
  const labels = {
    [FAMILY_SITUATION.SINGLE]: 'Célibataire',
    [FAMILY_SITUATION.MARRIED]: 'Marié(e)',
    [FAMILY_SITUATION.DIVORCED]: 'Divorcé(e)',
    [FAMILY_SITUATION.WIDOWED]: 'Veuf/Veuve'
  };
  return labels[situation] || situation;
};

const formatDate = (date: Date | null) => {
  if (!date) return 'Non spécifié';
  return new Date(date).toLocaleDateString('fr-FR');
};

const getTeachingInfo = (teachings: Teaching[]) => {
  if (!teachings || teachings.length === 0) return 'Non assigné';
  
  return teachings.map(teaching => {
    if (teaching.teachingType === 'CLASS_TEACHER') {
      return `Instituteur - ${teaching.class?.name || 'N/A'}`;
    } else {
      return `Professeur de ${teaching.course?.name || 'N/A'}${teaching.gradeNames ? ` - Classes: ${teaching.gradeNames}` : ''}`;
    }
  }).join(', ');
};
onMounted(loadProfessor);
</script>
<template>
  <div class="professor-details-view">
    <el-card v-if="professor" class="details-card">
      <template #header>
        <div class="card-header">
          <h2>{{ getCivilityLabel(professor.civility) }} {{ professor.firstname }} {{ professor.lastname }}</h2>
          <el-button-group>
            <el-button 
              type="primary"
              @click="router.push(`/professor/update/${professor.id}`)"
            >
              Modifier
            </el-button>
            <el-button 
              @click="router.push('/professor')"
            >
              Retour
            </el-button>
          </el-button-group>
        </div>
      </template>

      <div class="profile-content">
        <div class="photo-section">
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
            <el-avatar v-else :size="200">
              {{ professor.firstname[0] }}{{ professor.lastname[0] }}
            </el-avatar>
          </div>
        </div>

        <div class="info-section">
          <el-collapse accordion>
            <el-collapse-item title="Informations personnelles" name="1">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Civilité">
                  {{ getCivilityLabel(professor.civility) }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Situation familiale">
                  {{ getFamilySituationLabel(professor.family_situation) }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Nombre d'enfants">
                  {{ professor.nbr_child }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Date de naissance">
                  {{ formatDate(professor.birth_date) }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Lieu de naissance">
                  {{ professor.birth_town }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Adresse">
                  {{ professor.address }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Ville">
                  {{ professor.town }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Numéro CNI">
                  {{ professor.cni_number }}
                </el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>

            <el-collapse-item title="Qualifications" name="2">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Diplôme">
                  {{ professor.diploma?.name || 'Non spécifié' }}
                </el-descriptions-item>
                
                <el-descriptions-item label="Qualification">
                  {{ professor.qualification?.name || 'Non spécifié' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>

            <el-collapse-item title="Affectation" name="3">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="Poste actuel">
                  {{ professor.teaching ? getTeachingInfo(professor.teaching) : 'Non assigné' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>

            <el-collapse-item title="Documents" name="4">
              <div class="documents-section">
                <el-empty v-if="!professor.documents?.length" description="Aucun document" />
                <el-table v-else :data="professor.documents" border>
                  <el-table-column prop="name" label="Nom" />
                  <el-table-column label="Actions" width="120" align="center">
                    <template #default="{ row }">
                      <el-button-group>
                        <el-button 
                          type="primary" 
                          :icon="View"
                          circle
                          @click="viewDocument(row)"
                        />
                        <el-button 
                          type="success" 
                          :icon="Download"
                          circle
                          @click="downloadDocument(row)"
                        />
                      </el-button-group>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </el-card>

    <el-empty 
      v-else-if="!loading" 
      description="Professeur non trouvé"
    />

    <div v-else class="loading-container">
      <el-skeleton :rows="10" animated />
    </div>

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
.professor-details-view {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.details-card {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.profile-content {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 30px;
}

.photo-section {
  position: sticky;
  top: 20px;
}

.photo-container {
  width: 250px;
  height: 250px;
  margin: 0 auto;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.photo-container :deep(.el-image),
.photo-container :deep(.el-avatar) {
  width: 250px !important;
  height: 250px !important;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 48px;
}

.info-section {
  flex: 1;
}

:deep(.el-collapse-item__header) {
  font-size: 16px;
  font-weight: 600;
  color: #409EFF;
}

:deep(.el-descriptions) {
  margin: 10px 0;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
  color: #606266;
}

.documents-section {
  margin-top: 10px;
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

.loading-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background-color: white;
  border-radius: 4px;
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