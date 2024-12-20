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
  photo?: {
    path: string;
    type: string;
    url?: string;
  };
  documents?: Array<{
    id: number;
    name: string;
    path: string;
    type: string;
  }>;
  teaching?: Teaching[];
}

interface DocumentType {
  id: number;
  name: string;
  type: string;
  path: string;
}

const route = useRoute();
const router = useRouter();
const professor = ref<Professor | null>(null);
const loading = ref(false);
const dialogVisible = ref(false);
const currentDocument = ref<{
  id?: number;
  content?: string;
  type?: string;
  name?: string;
  path?: string;
} | null>(null);

const getImageUrl = async (path: string) => {
  try {
    const result = await window.ipcRenderer.invoke('file:getUrl', path);
    if (result.success) {
      return `data:${result.data.type};base64,${result.data.content}`;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
  }
  return '';
};

const viewDocument = async (document: DocumentType) => {
  try {
    const result = await window.ipcRenderer.invoke('file:getUrl', document.path);
    if (result.success) {
      currentDocument.value = {
        id: document.id,
        content: result.data.type === 'application/pdf' 
          ? result.data.content 
          : `data:${result.data.type};base64,${result.data.content}`,
        type: result.data.type,
        name: document.name,
        path: document.path
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

const loadProfessor = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:getById', Number(route.params.id));
    if (result.success) {
      const prof = result.data;
      if (prof.photo?.path) {
        const photoResult = await window.ipcRenderer.invoke('file:getImageUrl', prof.photo.path);
        if (photoResult.success) {
          prof.photo.url = `data:${prof.photo.type};base64,${photoResult.data}`;
        }
      }
      professor.value = prof;
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

const downloadDocument = async (doc: { path: string; name: string; id?: number; type?: string }) => {
  try {
    const result = await window.ipcRenderer.invoke('file:getUrl', doc.path);
    if (result.success) {
      const byteCharacters = atob(result.data.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.data.type });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      ElMessage.success('Document téléchargé avec succès');
    }
  } catch (error) {
    console.error("Erreur lors du téléchargement:", error);
    ElMessage.error('Erreur lors du téléchargement');
  }
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

      <div class="profile-section">
        <div class="photo-container">
          <img 
            v-if="professor.photo?.url"
            :src="professor.photo.url"
            class="profile-photo"
            alt="Photo de profil"
          />
          <el-avatar v-else :size="150">
            {{ professor.firstname[0] }}{{ professor.lastname[0] }}
          </el-avatar>
        </div>

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

        <el-divider>Qualifications</el-divider>

        <el-descriptions :column="2" border>
          <el-descriptions-item label="Diplôme">
            {{ professor.diploma?.name || 'Non spécifié' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="Qualification">
            {{ professor.qualification?.name || 'Non spécifié' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>Affectation</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="Poste actuel">
            {{ professor.teaching ? getTeachingInfo(professor.teaching) : 'Non assigné' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>Documents</el-divider>
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
      v-if="currentDocument"
      v-model="dialogVisible"
      :title="currentDocument.name"
      width="80%"
      destroy-on-close
    >
      <div class="document-viewer">
        <template v-if="currentDocument?.type?.includes('pdf')">
          <iframe
            :src="currentDocument.content"
            style="width: 100%; height: 100%;"
            frameborder="0"
          />
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
              @click="currentDocument?.id && professor ? downloadDocument({
                id: currentDocument.id,
                name: currentDocument?.name || '',
                type: currentDocument?.type || '',
                path: professor?.documents?.find(d => Number(d.id) === Number(currentDocument?.id))?.path || ''
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
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0;
  font-size: 24px;
  color: #303133;
}

.loading-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  background-color: white;
  border-radius: 4px;
}

:deep(.el-descriptions) {
  margin-bottom: 20px;
}

:deep(.el-descriptions__label) {
  font-weight: bold;
  color: #606266;
}

.profile-section {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 30px;
  align-items: start;
}

.photo-container {
  position: sticky;
  top: 20px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.profile-photo {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.profile-photo:hover {
  transform: scale(1.05);
}

.documents-section {
  margin-top: 20px;
}

.el-descriptions, .el-divider, .documents-section {
  transition: all 0.3s ease;
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