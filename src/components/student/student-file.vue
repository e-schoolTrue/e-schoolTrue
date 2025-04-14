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
import { ElMessage, ElMessageBox } from "element-plus";
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

// Champs disponibles pour le mapping
const studentDataFields = {
  firstname: "Prénom",
  lastname: "Nom",
  birthDay: "Date de naissance",
  birthPlace: "Lieu de naissance",
  address: "Adresse",
  gradeId: "Classe (Grade)",
  fatherFirstname: "Prénom du père",
  fatherLastname: "Nom du père",
  motherFirstname: "Prénom de la mère",
  motherLastname: "Nom de la mère",
  famillyPhone: "Téléphone familial",
  personalPhone: "Téléphone personnel",
  sex: "Sexe",
  schoolYear: "Année scolaire",
};

// Ouvre le sélecteur de fichiers

// Gestion de la sélection de fichier
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

//
// Dans votre composant d'import
const fetchGradeMappings = async () => {
  try {
    // Récupérer la liste des grades depuis le backend
    const grades = await window.ipcRenderer.invoke("grade:all");

    // Créer un objet de mapping
    const gradeMapping: Record<string, number> = {};
    grades.data.forEach((grade: { id: number; name: string }) => {
      gradeMapping[grade.name] = grade.id;
    });

    return gradeMapping;
  } catch (error) {
    console.error("Erreur lors de la récupération des grades:", error);
    ElMessage.error("Impossible de récupérer la liste des grades");
    return {};
  }
};

const validateImport = async () => {
  try {
    // Récupérer le mapping des grades
    const gradeMapping = await fetchGradeMappings();

    // Collecter les grades non trouvés
    const notFoundGrades: string[] = [];

    const mappedData = excelData.value.map((row) => {
      const mappedRow: Partial<IStudentData> = {};
      for (const [header, field] of Object.entries(columnMappings.value)) {
        if (field && row[header] !== undefined) {
          if (field === "birthDay" && row[header]) {
            mappedRow[field] = new Date(row[header]);
          } else if (field === "gradeId" && row[header]) {
            const gradeId = gradeMapping[row[header]];
            if (gradeId) {
              mappedRow[field] = gradeId;
            } else {
              notFoundGrades.push(row[header]);
            }
          } else {
            mappedRow[field] = row[header];
          }
        }
      }
      return mappedRow as IStudentData;
    });

    // Gérer les grades non trouvés
    if (notFoundGrades.length > 0) {
      const gradeListMessage = notFoundGrades.join(", ");
      const confirmImport = await ElMessageBox.confirm(
        `Les grades suivants n'ont pas été trouvés : ${gradeListMessage}. 
        Voulez-vous continuer l'import avec ces étudiants sans grade ?`,
        "Grades non trouvés",
        {
          confirmButtonText: "Continuer",
          cancelButtonText: "Annuler",
          type: "warning",
        }
      );

      // Si l'utilisateur annule, arrêter l'import
      if (confirmImport !== "confirm") {
        return;
      }
    }

    emit("fileLoaded", mappedData as IStudentData[]);
    showFileReader.value = false;
    ElMessage.success("Données mappées avec succès");
  } catch (error) {
    console.error("Erreur lors du mapping des données:", error);
    ElMessage.error("Erreur lors du mapping des données");
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
  return Object.values(columnMappings.value).some((field) => field !== "");
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
</style>
