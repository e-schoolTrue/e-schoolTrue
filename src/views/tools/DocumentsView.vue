<template>
  <div class="documents-view">
    <el-tabs v-model="activeTab">
      <div class="actions-footer">
      <el-button type="primary" @click="save" :loading="isSaving">
        Enregistrer les modifications
      </el-button>
    </div>
      <el-tab-pane label="Attestation d'inscription" name="inscription">
        <div class="single-preview">
          <div class="preview-wrapper">
            <div class="preview-zoom">
              <InscriptionPreview
                ref="inscriptionRef"
                :content="inscriptionContent"
                :school-info="schoolInfo || undefined"
                :logo-url="logoPreview || undefined"
                :editable="true"
              />
            </div>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="Certificat de scolarité" name="scolarite">
        <div class="single-preview">
          <div class="preview-wrapper">
            <div class="preview-zoom">
              <ScolaritePreview
                ref="scolariteRef"
                :content="scolariteContent"
                :school-info="schoolInfo || undefined"
                :logo-url="logoPreview || undefined"
                :editable="true"
              />
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import InscriptionPreview from '@/components/document/inscription.vue';
import ScolaritePreview from '@/components/document/scolarite.vue';
import {IDocument} from '@/types/document';
import type { ISchoolData } from '@/types/school';

const activeTab = ref('inscription');
const inscriptionContent = ref('');
const scolariteContent = ref('');
const documentId = ref('');
const isSaving = ref(false);
const schoolInfo = ref<ISchoolData | null>(null);
const logoPreview = ref<string>('');
const inscriptionRef = ref<any>(null);
const scolariteRef = ref<any>(null);

const loadDocuments = async () => {
  try {
    const res = await window.documentContent.get();
    if (res.success && res.data) {
      const data = res.data;
      inscriptionContent.value = data.inscription || '';
      scolariteContent.value = data.scolarite || '';
      documentId.value = data.id;
    } else {
      ElMessage.error("Une erreur est survenue.");
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du contenu des documents:', error);
    ElMessage.error("Une erreur est survenue.");
  }
};

const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result?.success && result.data) {
      schoolInfo.value = result.data;

      // Charger le logo comme dans SchoolInfoView
      const info = schoolInfo.value;
      if (info && info.logo?.id) {
        try {
          const logoResult = await window.ipcRenderer.invoke('school:getLogo', info.logo.id);
          if (logoResult.success && logoResult.data && logoResult.data.content) {
            logoPreview.value = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
          } else {
            logoPreview.value = '';
          }
        } catch (error) {
          console.error("Erreur lors du chargement du logo:", error);
          logoPreview.value = '';
        }
      } else {
        logoPreview.value = '';
      }
    }
  } catch (error) {
    console.error("Erreur lors du chargement des informations de l'école:", error);
  }
};

onMounted(async () => {
  await Promise.all([
    loadDocuments(),
    loadSchoolInfo(),
  ]);
});

const save = async () => {
  isSaving.value = true;
  try {
    // Récupérer le HTML édité directement depuis les composants (mode Canva)
    const extractHtml = (compRef: any) => {
      if (!compRef || !compRef.$el) return '';
      const root = compRef.$el as HTMLElement;
      const card = root.querySelector('.certificate-card') as HTMLElement | null;
      return card ? card.innerHTML : root.innerHTML;
    };

    inscriptionContent.value = extractHtml(inscriptionRef.value);
    scolariteContent.value = extractHtml(scolariteRef.value);

    const payload: Partial<IDocument> = {
      id: documentId.value,
      inscription: inscriptionContent.value,
      scolarite: scolariteContent.value,
    };
    const res = await window.documentContent.update(payload);
    if(res.success) {
      ElMessage.success("Modifications enregistrées avec succès.");
    } else {
      ElMessage.error("Une erreur est survenue.");
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des modifications:', error);
    ElMessage.error("Une erreur est survenue.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.documents-view {
  padding: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden; /* Prevent the main view from scrolling */
}
.el-tabs {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Ensure tabs don't overflow */
}
:deep(.el-tabs__content) {
  flex-grow: 1;
  overflow: hidden; /* Ensure tab content doesn't overflow */
  display: flex;
  flex-direction: column;
}
.el-tab-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.el-row {
  height: 100%;
}
.el-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.el-textarea {
  flex-grow: 1;
}
:deep(.el-textarea__inner) {
  height: 100% !important;
  font-family: monospace;
}
.single-preview {
  flex: 1; /* Take remaining space */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0; /* Important for flex containers to allow shrinking */
}
.preview-wrapper {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 10px;
  background-color: #f5f7fa;
}

.preview-zoom {
  transform: scale(0.6);
  transform-origin: top center;
  /* Ensure the zoomed content doesn't cause horizontal overflow issues if not needed */
  min-width: 21cm; 
  margin-bottom: 20px; /* Add some space at the bottom for scrolling */
}
.actions-footer {
  flex-shrink: 0; /* Prevent footer from shrinking */
  padding-top: 10px;
  text-align: right;
  background-color: white;
  border-top: 1px solid #e4e7ed;
  padding: 10px;
  z-index: 10; /* Ensure it stays on top */
}
h3 {
  margin-bottom: 10px;
}
</style>