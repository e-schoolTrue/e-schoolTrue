<template>
  <div class="excel-import-container">
    <input
      ref="fileInput"
      type="file"
      accept=".xlsx,.xls,.csv"
      style="display: none"
      @change="handleFileSelect"
    />
    <el-button type="primary" @click="openFileSelector" class="import-button">
      <Icon icon="mdi:upload" class="import-icon" />
      Importer un fichier
    </el-button>

    <el-dialog
      v-if="showFileReader"
      title="Importer un fichier"
      v-model="showFileReader"
      width="90%"
      destroy-on-close
    >
      <div class="import-dialog-content">
        <div class="file-info">
          <div class="file-details">
            <Icon icon="mdi:file-excel" class="file-icon" />
            <div class="file-text">
              <span class="file-name">
                {{ displayFileName }}
              </span>
              <span class="file-size">
                {{ displayFileSize }}
              </span>
            </div>
          </div>
        </div>

        <el-table
          :data="excelData"
          style="width: 100%"
          height="500"
          border
          highlight-current-row
        >
          <el-table-column
            v-for="header in fileHeaders"
            :key="header"
            :prop="header"
            :label="header"
            min-width="150"
          >
            <template #header="{ column }">
              <div class="custom-header">
                <div class="original-header" :class="{ 'mapped': columnMappings[header] }">
                  {{ column.label }}
                  <el-icon v-if="columnMappings[header]" class="mapped-icon">
                    <Icon icon="mdi:check-circle" />
                  </el-icon>
                </div>
                <el-select
                  v-model="columnMappings[header]"
                  placeholder="Mapper le champ"
                  size="small"
                  clearable
                  class="mapping-select"
                  :class="{ 'mapped-select': columnMappings[header] }"
                >
                  <el-option
                    v-for="(label, field) in studentDataFields"
                    :key="field"
                    :label="label"
                    :value="field"
                  />
                </el-select>
              </div>
            </template>
          </el-table-column>
        </el-table>
        
        <!-- Sélecteur de classe -->
        <div class="grade-selector">
          <h3>Sélection de la classe pour tous les étudiants importés</h3>
          <el-select
            v-model="selectedGradeId"
            placeholder="Sélectionner une classe"
            class="grade-select"
          >
            <el-option
              v-for="grade in availableGrades"
              :key="grade.id"
              :label="grade.name"
              :value="grade.id"
            />
          </el-select>
          <p class="grade-info">
            <el-icon><Icon icon="mdi:information" /></el-icon>
            Tous les étudiants importés seront assignés à cette classe, indépendamment de ce qui est indiqué dans le fichier.
          </p>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleClose">Fermer</el-button>
          <el-button
            type="primary"
            @click="validateImport"
            :disabled="!isValidMapping"
          >
            Valider l'import
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Icon } from "@iconify/vue";
import { ElMessage } from "element-plus";
import * as XLSX from "xlsx";
import type { IStudentData } from '@/types/student';

// Définition des événements pour transmettre les données mappées
const emit = defineEmits<{
  (e: "fileLoaded", data: IStudentData[]): void;
}>();

// Références et données du composant
const showFileReader = ref(false);

const fileInput = ref<HTMLInputElement | null>(null);
const excelData = ref<any[]>([]);
const fileHeaders = ref<string[]>([]);
const columnMappings = ref<Record<string, string>>({});
const selectedGradeId = ref<number | null>(null);
const availableGrades = ref<{id: number, name: string}[]>([]);

// Champs disponibles pour le mapping
const studentDataFields = {
  firstname: "Prénom",
  lastname: "Nom",
  birthDay: "Date de naissance",
  birthPlace: "Lieu de naissance",
  address: "Adresse",
  fatherFirstname: "Prénom du père",
  fatherLastname: "Nom du père",
  motherFirstname: "Prénom de la mère",
  motherLastname: "Nom de la mère",
  famillyPhone: "Téléphone familial",
  personalPhone: "Téléphone personnel",
  sex: "Genre",
  schoolYear: "Année scolaire",
} as const;

// Champs obligatoires pour la création d'un étudiant
const requiredFields = ["firstname", "lastname", "fatherFirstname", "fatherLastname"] as const;

// Chargement des classes disponibles
const loadAvailableGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success && result.data) {
      availableGrades.value = result.data.map((grade: any) => ({
        id: grade.id,
        name: grade.name
      }));
      
      // Sélectionner la première classe par défaut si disponible
      if (availableGrades.value.length > 0) {
        selectedGradeId.value = availableGrades.value[0].id;
      }
    } else {
      ElMessage.warning('Impossible de charger les classes disponibles');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classes:', error);
    ElMessage.error('Erreur lors du chargement des classes');
  }
};

// Ouvre le sélecteur de fichiers
const openFileSelector = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    ElMessage.error("Aucun fichier sélectionné");
    return;
  }

  if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
    ElMessage.error("Veuillez sélectionner un fichier Excel ou CSV");
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
      excelData.value = sheetData;
      fileHeaders.value = Object.keys(sheetData[0] as Record<string, any>);
      showFileReader.value = true;
      
      // Charger les classes disponibles quand la boîte de dialogue s'ouvre
      loadAvailableGrades();
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier:", error);
      ElMessage.error("Erreur lors de la lecture du fichier");
    }
  };

  reader.onerror = (error) => {
    console.error("Erreur FileReader:", error);
    ElMessage.error("Erreur lors de la lecture du fichier");
  };

  reader.readAsArrayBuffer(file);
};

const displayFileName = computed(() => {
  const input = fileInput.value;
  return input && input.files && input.files.length > 0
    ? input.files[0].name
    : "Fichier importé";
});

const displayFileSize = computed(() => {
  const input = fileInput.value;
  return input && input.files && input.files.length > 0
    ? calculateFileSize(input.files[0].size)
    : "Taille inconnue";
});

// Fonction pour normaliser les chaînes (suppression d'accents, minuscules, etc.)

const validateImport = async () => {
  try {
    // Vérifier si une classe est sélectionnée
    if (!selectedGradeId.value) {
      ElMessage.error("Veuillez sélectionner une classe pour les étudiants importés");
      return;
    }

    // Utiliser un tableau de champs requis pour l'affichage des messages
    const requiredFieldsForDisplay = ["firstname", "lastname"];
    
    // Vérifier que les champs minimaux requis pour l'affichage sont mappés
    const mappedFields = Object.values(columnMappings.value);
    const missingDisplayFields = requiredFieldsForDisplay.filter(field => !mappedFields.includes(field));
    
    // Log des mappages pour débogage
    console.log("Mappages actuels:", columnMappings.value);
    console.log("Champs mappés:", mappedFields);
    console.log("Champs obligatoires pour l'affichage:", requiredFieldsForDisplay);
    console.log("Champs obligatoires pour le backend:", requiredFields);
    console.log("Champs manquants pour l'affichage:", missingDisplayFields);
    
    if (missingDisplayFields.length > 0) {
      const fieldLabels = missingDisplayFields.map(field => 
        studentDataFields[field as keyof typeof studentDataFields]
      ).join(", ");
      ElMessage.error(`Veuillez mapper au moins les champs suivants : ${fieldLabels}`);
      return;
    }

    // Pour le mapping des classes, nous allons modifier l'approche
    const mappedData = excelData.value.map((row, index) => {
      const mappedRow = {} as Record<string, any>;
      
      for (const [header, field] of Object.entries(columnMappings.value)) {
        if (field && row[header] !== undefined) {
          if (field === "birthDay" && row[header]) {
            // Convertir la date en objet Date
            try {
              const dateValue = new Date(row[header]);
              // Vérifier si la date est valide
              if (!isNaN(dateValue.getTime())) {
                mappedRow[field] = dateValue;
              } else {
                console.warn(`Date de naissance invalide pour la ligne ${index + 1}:`, row[header]);
                mappedRow[field] = null;
              }
            } catch (error) {
              console.warn(`Erreur lors de la conversion de la date pour la ligne ${index + 1}:`, error);
              mappedRow[field] = null;
            }
          } else if (field === "gradeId") {
            // Ne pas essayer de mapper la classe/grade automatiquement
            continue;
          } else if (field === "sex") {
            // Normaliser la valeur du sexe (male/female)
            const sexValue = String(row[header]).trim().toLowerCase();
            if (sexValue.includes('f') || sexValue.includes('fille') || sexValue.includes('femme') || sexValue === 'f') {
              mappedRow[field] = "female";
            } else {
              mappedRow[field] = "male";
            }
          } else {
            // S'assurer que toutes les valeurs sont des chaînes de caractères
            mappedRow[field] = String(row[header]);
          }
        }
      }
      
      // Ajouter des valeurs par défaut pour TOUS les champs obligatoires
      requiredFields.forEach(field => {
        if (!mappedRow[field]) {
          if (field.includes('firstname')) {
            mappedRow[field] = `Importé ${index + 1}`;
          } else if (field.includes('lastname')) {
            mappedRow[field] = `IMPORTÉ ${index + 1}`;
          }
          console.log(`Ajout d'une valeur par défaut pour ${field}:`, mappedRow[field]);
        }
      });
      
      // Assigner la classe sélectionnée manuellement
      mappedRow["gradeId"] = selectedGradeId.value;
      
      // Ajouter l'année scolaire par défaut si non définie
      if (!mappedRow["schoolYear"]) {
        const currentYear = new Date().getFullYear();
        mappedRow["schoolYear"] = `${currentYear}-${currentYear + 1}`;
      }
      
      // S'assurer que tous les champs importants ont des valeurs par défaut
      mappedRow["birthPlace"] = mappedRow["birthPlace"] || 'Non spécifié';
      mappedRow["address"] = mappedRow["address"] || 'Non spécifié';
      mappedRow["famillyPhone"] = mappedRow["famillyPhone"] || '000000000';
      mappedRow["personalPhone"] = mappedRow["personalPhone"] || '';
      mappedRow["sex"] = mappedRow["sex"] || 'male';
      
      // Préparer des champs null/vides pour les documents et la photo
      mappedRow["documents"] = [];
      mappedRow["photo"] = null;
      
      return mappedRow as IStudentData;
    });
    
    // Vérifier si des données sont vides et les compléter
    for (let i = 0; i < mappedData.length; i++) {
      const student = mappedData[i];
      
      // Log pour débogage
      console.log(`Étudiant ${i + 1}:`, student);
      
      // Assurer que les valeurs ne sont pas vides
      if (!student.firstname || !student.lastname) {
        ElMessage.warning(`Ligne ${i + 1}: Prénom ou nom manquant, valeurs par défaut utilisées`);
      }
    }

    emit("fileLoaded", mappedData as IStudentData[]);
    showFileReader.value = false;
    ElMessage.success("Données mappées avec succès");
  } catch (error) {
    console.error("Erreur lors du mapping des données:", error);
    ElMessage.error("Erreur lors du mapping des données: " + (error instanceof Error ? error.message : String(error)));
  }
};
// Réinitialisation et fermeture de la boîte de dialogue
const handleClose = () => {
  showFileReader.value = false;
  excelData.value = [];
  fileHeaders.value = [];
  columnMappings.value = {};
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};
// Calculate file size
const calculateFileSize = (bytes?: number | undefined): string => {
  if (bytes == null) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// Validate mapping
const isValidMapping = computed(() => {
  // Ensure at least some fields are mapped
  const hasMappings = Object.values(columnMappings.value).some((field) => field !== "");
  
  // Vérifier également si une classe est sélectionnée
  const hasGrade = selectedGradeId.value !== null;
  
  // Seuls les champs minimaux obligatoires pour l'affichage doivent être mappés
  // Les autres champs obligatoires seront remplis automatiquement
  const requiredDisplayFields = ["firstname", "lastname"];
  const hasRequiredDisplayFields = requiredDisplayFields.every(field => 
    Object.values(columnMappings.value).includes(field)
  );
  
  return hasMappings && hasGrade && hasRequiredDisplayFields;
});
</script>

<style scoped>
.excel-import-container {
  width: 100%;
}

.import-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.import-icon {
  font-size: 18px;
}

.import-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.file-info {
  display: flex;
  align-items: center;
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 8px;
}

.file-details {
  display: flex;
  align-items: center;
  gap: 15px;
}

.file-icon {
  font-size: 40px;
  color: #10b981;
}

.file-text {
  display: flex;
  flex-direction: column;
}

.file-name {
  font-weight: 600;
  color: #2c3e50;
}

.file-size {
  font-size: 12px;
  color: #6c757d;
}

.custom-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.original-header {
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.original-header.mapped {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.mapped-icon {
  color: #67c23a;
  font-size: 16px;
  margin-left: 8px;
}

.mapping-select {
  width: 100%;
  transition: all 0.3s ease;
}

.mapped-select :deep(.el-input__wrapper) {
  background-color: #f0f9eb;
  box-shadow: 0 0 0 1px #67c23a inset;
}

.mapped-select :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #67c23a inset !important;
}

.mapped-select :deep(.el-select__tags) {
  background-color: #f0f9eb;
}

.mapping-summary {
  margin-top: 15px;
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 8px;
}

.mapped-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.mapped-label {
  font-weight: 600;
  color: #2c3e50;
  margin-right: 10px;
}

.mapped-tag {
  margin-right: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.grade-selector {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.grade-select {
  width: 100%;
}

.grade-info {
  margin-top: 10px;
  font-size: 12px;
  color: #6c757d;
}
</style>
