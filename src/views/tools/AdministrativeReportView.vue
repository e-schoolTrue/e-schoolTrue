<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

// --- Interfaces ---
interface ReportConfig {
  periodType: 'year' | 'term' | 'month';
  periodValue: string;
  targetType: 'school' | 'level' | 'class';
  targetValue: number | null;
  reportType: 'activity' | 'results' | 'absences' | 'custom';
}

interface ReportContent {
  title: string;
  introduction: string;
  sections: {
    stats: boolean;
    details: boolean;
    conclusion: boolean;
  };
  conclusion: string;
}

// --- State ---
const activeStep = ref(0);
const loading = ref(false);
const generatingAI = ref(false);

const config = reactive<ReportConfig>({
  periodType: 'term',
  periodValue: '',
  targetType: 'school',
  targetValue: null,
  reportType: 'activity'
});

const content = reactive<ReportContent>({
  title: 'Rapport Administratif',
  introduction: '',
  sections: {
    stats: true,
    details: true,
    conclusion: true
  },
  conclusion: ''
});

// Data sources
const levels = ref<any[]>([]);
const classes = ref<any[]>([]);
const schoolInfo = ref<any>(null);

// --- Computed ---
const isConfigValid = computed(() => {
  if (config.periodType !== 'year' && !config.periodValue) return false;
  if (config.targetType !== 'school' && !config.targetValue) return false;
  return true;
});

const previewTitle = computed(() => {
    return content.title || 'Rapport sans titre';
});

// --- Methods ---
const loadData = async () => {
  try {
    loading.value = true;
    const [levelsResult, classesResult, schoolResult] = await Promise.all([
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('classRoom:all'),
      window.ipcRenderer.invoke('school:get')
    ]);

    if (levelsResult?.success) levels.value = levelsResult.data;
    if (classesResult?.success) classes.value = classesResult.data;
    if (schoolResult?.success) schoolInfo.value = schoolResult.data;

  } catch (error) {
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

const nextStep = () => {
  if (activeStep.value < 2) activeStep.value++;
};

const prevStep = () => {
  if (activeStep.value > 0) activeStep.value--;
};

const generateAIContent = async () => {
  generatingAI.value = true;
  // Simulation d'appel IA
  setTimeout(() => {
    const periodText = config.periodType === 'term' ? `pour le ${config.periodValue}` : `pour l'année en cours`;
    const targetText = config.targetType === 'school' ? "de l'établissement" : "de la classe sélectionnée";
    
    content.introduction = `Ce rapport présente une analyse détaillée des activités et des résultats ${targetText} ${periodText}. Il met en lumière les progrès réalisés ainsi que les points d'attention pour la période à venir.`;
    content.conclusion = `En conclusion, la période a été marquée par une dynamique positive. Nous recommandons de poursuivre les efforts engagés, notamment sur l'assiduité et la participation en classe.`;
    
    generatingAI.value = false;
    ElMessage.success('Contenu généré par IA');
  }, 1500);
};

const exportPDF = () => {
  window.print();
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="report-view-container">
    <div class="header-section no-print">
      <h1><Icon icon="mdi:file-document-edit-outline" class="mr-2"/> Création de Rapport</h1>
      <p class="subtitle">Générez des rapports administratifs complets en quelques clics</p>
    </div>


    <!-- Step 1: Configuration -->
    <div v-if="activeStep === 0" class="step-content no-print">
      <el-card class="config-card">
        <template #header>
          <div class="card-header">
            <span>Paramètres du rapport</span>
          </div>
        </template>
        
        <el-form label-position="top">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Type de Période">
                <el-radio-group v-model="config.periodType">
                  <el-radio-button label="year">Année</el-radio-button>
                  <el-radio-button label="term">Trimestre</el-radio-button>
                  <el-radio-button label="month">Mois</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>
            
            <el-col :span="12" v-if="config.periodType !== 'year'">
              <el-form-item :label="config.periodType === 'term' ? 'Trimestre' : 'Mois'">
                <el-select v-model="config.periodValue" class="w-full">
                  <el-option v-if="config.periodType === 'term'" v-for="i in 3" :key="i" :label="`Trimestre ${i}`" :value="`Trimestre ${i}`" />
                  <el-option v-if="config.periodType === 'month'" v-for="m in ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin']" :key="m" :label="m" :value="m" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Cible">
                <el-radio-group v-model="config.targetType">
                  <el-radio-button label="school">École entière</el-radio-button>
                  <el-radio-button label="level">Niveau</el-radio-button>
                  <el-radio-button label="class">Classe</el-radio-button>
                </el-radio-group>
              </el-form-item>
            </el-col>

            <el-col :span="12" v-if="config.targetType !== 'school'">
              <el-form-item :label="config.targetType === 'level' ? 'Niveau' : 'Classe'">
                <el-select v-model="config.targetValue" class="w-full" placeholder="Sélectionner">
                   <template v-if="config.targetType === 'level'">
                      <el-option v-for="l in levels" :key="l.id" :label="l.name" :value="l.id" />
                   </template>
                   <template v-else>
                      <el-option v-for="c in classes" :key="c.id" :label="c.name" :value="c.id" />
                   </template>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="Type de Rapport">
            <div class="report-types">
              <div 
                class="type-card" 
                :class="{ active: config.reportType === 'activity' }"
                @click="config.reportType = 'activity'"
              >
                <Icon icon="mdi:chart-timeline-variant" class="type-icon"/>
                <span>Activité</span>
              </div>
              <div 
                class="type-card" 
                :class="{ active: config.reportType === 'results' }"
                @click="config.reportType = 'results'"
              >
                <Icon icon="mdi:school-outline" class="type-icon"/>
                <span>Résultats</span>
              </div>
              <div 
                class="type-card" 
                :class="{ active: config.reportType === 'absences' }"
                @click="config.reportType = 'absences'"
              >
                <Icon icon="mdi:account-clock-outline" class="type-icon"/>
                <span>Absences</span>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- Step 2: Customization -->
    <div v-if="activeStep === 1" class="step-content no-print">
      <el-row :gutter="20">
        <el-col :span="16">
          <el-card>
            <template #header>
              <div class="card-header flex justify-between items-center">
                <span>Contenu du rapport</span>
                <el-button type="primary" plain size="small" @click="generateAIContent" :loading="generatingAI">
                  <Icon icon="mdi:magic-staff" class="mr-2"/> Générer avec IA
                </el-button>
              </div>
            </template>
            
            <el-form label-position="top">
              <el-form-item label="Titre du rapport">
                <el-input v-model="content.title" />
              </el-form-item>
              
              <el-form-item label="Introduction / Message d'ouverture">
                <el-input 
                  v-model="content.introduction" 
                  type="textarea" 
                  :rows="4" 
                  placeholder="Contexte du rapport, objectifs..."
                />
              </el-form-item>

              <el-form-item label="Conclusion / Recommandations">
                <el-input 
                  v-model="content.conclusion" 
                  type="textarea" 
                  :rows="4" 
                  placeholder="Synthèse, actions à venir..."
                />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card>
            <template #header><span>Sections à inclure</span></template>
            <div class="flex flex-col gap-4">
              <el-switch v-model="content.sections.stats" active-text="Statistiques Globales" />
              <el-switch v-model="content.sections.details" active-text="Détails par classe/élève" />
              <el-switch v-model="content.sections.conclusion" active-text="Conclusion" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Step 3: Preview -->
    <div v-if="activeStep === 2" class="step-content preview-mode">
      <div class="preview-paper">
        <!-- Report Header -->
        <div class="report-header">
           <div class="school-logo" v-if="schoolInfo?.logo">
              <!-- Placeholder for logo if needed, or use img tag -->
              <Icon icon="mdi:school" class="text-4xl text-gray-400" v-if="!schoolInfo.logo"/>
           </div>
           <div class="school-info">
             <h2>{{ schoolInfo?.name || 'Nom de l\'école' }}</h2>
             <p>{{ schoolInfo?.address }}</p>
             <p>{{ schoolInfo?.email }} | {{ schoolInfo?.phone }}</p>
           </div>
           <div class="report-meta">
             <p>Date: {{ new Date().toLocaleDateString() }}</p>
             <p>Période: {{ config.periodType === 'year' ? 'Année' : config.periodValue }}</p>
           </div>
        </div>

        <div class="report-title">
          <h1>{{ previewTitle }}</h1>
          <div class="title-underline"></div>
        </div>

        <div class="report-body">
          <div class="section intro-section">
            <h3>Introduction</h3>
            <p>{{ content.introduction || 'Aucune introduction saisie.' }}</p>
          </div>

          <div class="section stats-section" v-if="content.sections.stats">
            <h3>Statistiques Clés</h3>
            <div class="stats-grid-preview">
               <div class="stat-box">
                 <span class="stat-label">Total Élèves</span>
                 <span class="stat-value">1,245</span>
               </div>
               <div class="stat-box">
                 <span class="stat-label">Taux de Réussite</span>
                 <span class="stat-value">94%</span>
               </div>
               <div class="stat-box">
                 <span class="stat-label">Absences Moy.</span>
                 <span class="stat-value">2.5j</span>
               </div>
            </div>
             <p class="mock-note text-gray-400 text-sm italic mt-2">* Données simulées pour l'aperçu</p>
          </div>

          <div class="section details-section" v-if="content.sections.details">
             <h3>Détails de l'activité</h3>
             <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
             <!-- Placeholder for charts/tables -->
             <div class="placeholder-chart">
               <Icon icon="mdi:chart-bar" class="text-6xl text-gray-300"/>
               <span>Graphique d'évolution</span>
             </div>
          </div>

          <div class="section conclusion-section" v-if="content.sections.conclusion">
            <h3>Conclusion</h3>
            <p>{{ content.conclusion || 'Aucune conclusion saisie.' }}</p>
          </div>
        </div>

        <div class="report-footer">
          <p>Généré automatiquement par e-School True</p>
        </div>
      </div>
    </div>

    <!-- Actions Footer -->
    <div class="actions-footer no-print">
      <el-button @click="prevStep" :disabled="activeStep === 0">Précédent</el-button>
      <el-button v-if="activeStep < 2" type="primary" @click="nextStep" :disabled="!isConfigValid">Suivant</el-button>
      <el-button v-else type="success" @click="exportPDF">
        <Icon icon="mdi:file-pdf-box" class="mr-2"/> Exporter en PDF
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.report-view-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header-section {
  margin-bottom: 30px;
}

.header-section h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
}

.subtitle {
  color: #606266;
  margin-top: 5px;
}

.step-content {
  flex: 1;
  margin-bottom: 80px; /* Space for footer */
}

.config-card {
  max-width: 800px;
  margin: 0 auto;
}

.w-full { width: 100%; }
.mr-2 { margin-right: 8px; }
.mb-8 { margin-bottom: 32px; }

/* Report Types */
.report-types {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 10px;
}

.type-card {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.type-card:hover {
  border-color: #409EFF;
  background-color: #f0f9eb;
}

.type-card.active {
  border-color: #409EFF;
  background-color: #ecf5ff;
  color: #409EFF;
}

.type-icon {
  font-size: 32px;
}

/* Preview Styles */
.preview-mode {
  background-color: #525659;
  padding: 40px;
  border-radius: 8px;
  display: flex;
  justify-content: center;
}

.preview-paper {
  background: white;
  width: 210mm; /* A4 width */
  min-height: 297mm; /* A4 height */
  padding: 20mm;
  box-shadow: 0 0 20px rgba(0,0,0,0.3);
  color: #333;
  font-family: 'Times New Roman', serif;
}

.report-header {
  display: flex;
  justify-content: space-between;
  border-bottom: 2px solid #333;
  padding-bottom: 20px;
  margin-bottom: 40px;
}

.school-info h2 {
  margin: 0;
  font-size: 18px;
  text-transform: uppercase;
}

.report-title {
  text-align: center;
  margin-bottom: 40px;
}

.report-title h1 {
  font-size: 28px;
  margin: 0;
  color: #2c3e50;
}

.title-underline {
  width: 100px;
  height: 3px;
  background: #409EFF;
  margin: 10px auto;
}

.section {
  margin-bottom: 30px;
}

.section h3 {
  font-size: 16px;
  color: #409EFF;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  margin-bottom: 15px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stats-grid-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin: 20px 0;
}

.stat-box {
  background: #f8f9fa;
  padding: 15px;
  text-align: center;
  border-radius: 4px;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.placeholder-chart {
  height: 200px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  border: 1px dashed #ccc;
  border-radius: 4px;
  margin-top: 10px;
}

.report-footer {
  margin-top: 50px;
  text-align: center;
  font-size: 10px;
  color: #999;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

/* Actions Footer */
.actions-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 15px 40px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  z-index: 100;
}

/* Print Styles */
@media print {
  .no-print {
    display: none !important;
  }
  
  .report-view-container {
    padding: 0;
    margin: 0;
    width: 100%;
  }

  .preview-mode {
    background: none;
    padding: 0;
  }

  .preview-paper {
    box-shadow: none;
    width: 100%;
    margin: 0;
    padding: 0;
  }
}
</style>
