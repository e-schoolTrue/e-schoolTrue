<!-- FileUploader.vue -->
<template>
  <input
    ref="fileInput"
    type="file"
    accept=".xlsx,.xls,.csv"
    style="display: none"
    @change="handleFileSelect"
  />
  <el-button 
    type="primary" 
    @click="openFileSelector"
    class="import-button"
  >
    <el-icon class="el-icon--left"><upload-filled /></el-icon>
    Importer un fichier
  </el-button>

  <el-dialog v-if="showFileReader" title="Mapper les champs" v-model="showFileReader" width="80%">
    <div class="mapping-container">
      <div v-for="header in fileHeaders" :key="header" class="mapping-row">
        <span>{{ header }}</span>
        <el-select v-model="columnMappings[header]" placeholder="Sélectionnez un champ">
          <el-option
            v-for="(label, field) in studentDataFields"
            :key="field"
            :label="label"
            :value="field"
          />
        </el-select>
      </div>
    </div>

    <el-table :data="excelData" style="width: 100%" height="400" border>
      <el-table-column
        v-for="(_value, key) in (excelData[0] || {})"
        :key="key"
        :prop="key"
        :label="key"
        min-width="120"
      />
    </el-table>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">Fermer</el-button>
        <el-button type="primary" @click="validateImport">
          Valider l'import
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';

interface StudentData {
  firstname: string;
  lastname: string;
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
  photo: File | null;
  document: File | null;
  sex: 'male' | 'female';
  schoolYear: string;
}

const emit = defineEmits<{
  (e: 'fileLoaded', data: StudentData[]): void
}>();

const showFileReader = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const excelData = ref<any[]>([]);
const fileHeaders = ref<string[]>([]);
const columnMappings = ref<Record<string, string>>({});

const studentDataFields = {
  firstname: 'Prénom',
  lastname: 'Nom',
  birthDay: 'Date de naissance',
  birthPlace: 'Lieu de naissance',
  address: 'Adresse',
  classId: 'Classe',
  fatherFirstname: 'Prénom du père',
  fatherLastname: 'Nom du père',
  motherFirstname: 'Prénom de la mère',
  motherLastname: 'Nom de la mère',
  famillyPhone: 'Téléphone familial',
  personalPhone: 'Téléphone personnel',
  photo: 'Photo',
  document: 'Document',
  sex: 'Sexe',
  schoolYear: 'Année scolaire',
};

const openFileSelector = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
    ElMessage.error('Veuillez sélectionner un fichier Excel ou CSV');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
      excelData.value = sheetData;
      fileHeaders.value = Object.keys(sheetData[0] as Record<string, any>);
      showFileReader.value = true;
    } catch (error) {
      console.error('Erreur lors de la lecture du fichier:', error);
      ElMessage.error('Erreur lors de la lecture du fichier');
    }
  };

  reader.onerror = (error) => {
    console.error('Erreur FileReader:', error);
    ElMessage.error('Erreur lors de la lecture du fichier');
  };

  reader.readAsArrayBuffer(file);
};

const validateImport = () => {
  try {
    const mappedData = excelData.value.map(row => {
      const mappedRow: Partial<StudentData> = {};
      for (const [header, field] of Object.entries(columnMappings.value)) {
        if (field && row[header] !== undefined) {
          if (field === 'birthDay' && row[header]) {
            // Convertir la date Excel en objet Date
            mappedRow[field] = new Date(row[header]);
          } else if (field === 'classId' && row[header]) {
            // Convertir classId en nombre
            mappedRow[field] = Number(row[header]);
          } else {
            mappedRow[field as keyof StudentData] = row[header];
          }
        }
      }
      return mappedRow;
    });

    emit('fileLoaded', mappedData as StudentData[]);
    showFileReader.value = false;
    ElMessage.success('Données mappées avec succès');
  } catch (error) {
    console.error('Erreur lors du mapping des données:', error);
    ElMessage.error('Erreur lors du mapping des données');
  }
};

const handleClose = () => {
  showFileReader.value = false;
  excelData.value = [];
  fileHeaders.value = [];
  columnMappings.value = {};
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};
</script>

<style scoped>
.mapping-container {
  margin-bottom: 20px;
}
.mapping-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.import-button {
  display: inline-flex;
  align-items: center;
}
.el-icon--left {
  margin-right: 8px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>