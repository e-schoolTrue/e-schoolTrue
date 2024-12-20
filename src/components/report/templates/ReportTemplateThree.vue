<template>
  <div class="report-template-three">
    <!-- Header minimaliste -->
    <header class="modern-header">
      <div class="school-brand">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo" class="school-logo">
        <div class="school-name">{{ schoolInfo?.name }}</div>
      </div>
      <div class="report-info">
        <h1>Bulletin de Notes</h1>
        <div class="period-badge">{{ periodLabel }}</div>
        <div class="academic-year">{{ currentYear }}</div>
      </div>
    </header>

    <!-- Profil étudiant -->
    <section class="student-profile">
      <div class="profile-grid">
        <div class="profile-photo">
          <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo">
          <div v-else class="photo-placeholder">
            <Icon icon="mdi:account" class="placeholder-icon" />
          </div>
        </div>
        <div class="profile-info">
          <div class="info-grid">
            <div class="info-item">
              <label>Nom</label>
              <span>{{ student?.lastname }}</span>
            </div>
            <div class="info-item">
              <label>Prénom</label>
              <span>{{ student?.firstname }}</span>
            </div>
            <div class="info-item">
              <label>Matricule</label>
              <span>{{ student?.matricule }}</span>
            </div>
            <div class="info-item">
              <label>Classe</label>
              <span>{{ student?.grade?.name }}</span>
            </div>
          </div>
        </div>
        <div class="performance-metrics">
          <div class="metric">
            <div class="metric-value">{{ formatGrade(generalAverage) }}/20</div>
            <div class="metric-label">Moyenne Générale</div>
          </div>
          <div class="metric">
            <div class="metric-value">{{ rank }}/{{ totalStudents }}</div>
            <div class="metric-label">Classement</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Résultats par matière -->
    <section class="results-section">
      <div class="results-grid">
        <div v-for="(group, index) in groupedGrades" 
             :key="index"
             class="subject-group">
          <h3 class="group-title">{{ group.name }}</h3>
          <div class="grades-cards">
            <div v-for="grade in group.grades" 
                 :key="grade.courseId"
                 class="grade-card"
                 :class="getGradeClass(grade.grade)">
              <div class="grade-header">
                <span class="course-name">{{ grade.courseName }}</span>
                <span class="coefficient">Coef. {{ grade.coefficient }}</span>
              </div>
              <div class="grade-body">
                <div class="grade-value">{{ formatGrade(grade.grade) }}</div>
                <div class="grade-average">
                  Moyenne classe: {{ formatGrade(grade.classAverage) }}
                </div>
              </div>
              <div class="grade-footer">
                <p class="appreciation">{{ grade.appreciation }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Graphique radar des compétences -->
    <section class="skills-chart">
      <h3>Compétences par domaine</h3>
      <div class="chart-container">
        <!-- Intégrer ici un graphique radar -->
      </div>
    </section>

    <!-- Observations -->
    <section class="observations-section">
      <div class="observation-card">
        <h3>Appréciation générale</h3>
        <p>{{ observations }}</p>
        <div class="mention">
          <span class="mention-label">Mention :</span>
          <span class="mention-value">{{ getGeneralAppreciation() }}</span>
        </div>
      </div>
    </section>

    <!-- Signatures modernes -->
    <section class="signatures-section">
      <div class="signature-grid">
        <div class="signature-card">
          <span class="signature-role">Direction</span>
          <div class="signature-area"></div>
        </div>
        <div class="signature-card">
          <span class="signature-role">Professeur Principal</span>
          <div class="signature-area"></div>
        </div>
        <div class="signature-card">
          <span class="signature-role">Parents</span>
          <div class="signature-area"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  student: any;
  grades: any[];
  period: string;
  config: any;
  schoolInfo?: any;
  rank?: number;
  totalStudents?: number;
  observations?: string;
}>();

// Computed properties et méthodes similaires aux autres templates...
const periodLabel = computed(() => {
  const labels: Record<string, string> = {
    trimester1: '1er Trimestre',
    trimester2: '2ème Trimestre',
    trimester3: '3ème Trimestre',
    semester1: '1er Semestre',
    semester2: '2ème Semestre',
    year: 'Année Scolaire'
  };
  return labels[props.period] || props.period;
});

const currentYear = computed(() => {
  const now = new Date();
  return `${now.getFullYear() - 1}/${now.getFullYear()}`;
});

const generalAverage = computed(() => {
  if (!props.grades?.length) return 0;
  
  const totalWeightedGrades = props.grades.reduce((sum, grade) => {
    return sum + (grade.grade * grade.coefficient);
  }, 0);
  
  const totalCoefficients = props.grades.reduce((sum, grade) => {
    return sum + grade.coefficient;
  }, 0);
  
  return totalWeightedGrades / totalCoefficients;
});

// Méthodes
const formatGrade = (grade: number): string => {
  return grade.toFixed(2);
};

const getGradeClass = (grade: number): string => {
  if (grade >= 16) return 'grade-excellent';
  if (grade >= 14) return 'grade-very-good';
  if (grade >= 12) return 'grade-good';
  if (grade >= 10) return 'grade-average';
  return 'grade-poor';
};

const getGeneralAppreciation = () => {
  const average = generalAverage.value;
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Insuffisant';
};
</script>

<style scoped>
.report-template-three {
  background: #fff;
  max-width: 210mm;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.modern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.school-brand {
  display: flex;
  align-items: center;
  gap: 15px;
}

.school-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.school-name {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
}

.report-info {
  text-align: right;
}

.period-badge {
  display: inline-block;
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border-radius: 20px;
  font-size: 14px;
  margin: 8px 0;
}

.student-profile {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 30px;
}

.profile-grid {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 20px;
  align-items: center;
}

.profile-photo img {
  width: 120px;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.info-item label {
  display: block;
  color: #666;
  font-size: 12px;
  margin-bottom: 4px;
}

.info-item span {
  font-size: 16px;
  font-weight: 500;
}

.performance-metrics {
  text-align: center;
}

.metric {
  margin-bottom: 15px;
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.metric-label {
  font-size: 12px;
  color: #666;
}

.results-grid {
  display: grid;
  gap: 30px;
}

.subject-group {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.group-title {
  padding: 15px;
  margin: 0;
  background: #f8f9fa;
  color: #2c3e50;
}

.grades-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  padding: 15px;
}

.grade-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 15px;
}

.grade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.course-name {
  font-weight: 500;
}

.coefficient {
  font-size: 12px;
  color: #666;
}

.grade-value {
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin: 15px 0;
}

.grade-average {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.observations-section {
  margin: 30px 0;
}

.observation-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
}

.mention {
  margin-top: 15px;
  text-align: right;
}

.mention-value {
  font-weight: bold;
  color: #2c3e50;
}

.signatures-section {
  margin-top: 40px;
}

.signature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.signature-card {
  text-align: center;
}

.signature-role {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.signature-area {
  height: 80px;
  border: 1px dashed #ddd;
  border-radius: 8px;
}

@media print {
  .report-template-three {
    padding: 0;
  }
}
</style> 