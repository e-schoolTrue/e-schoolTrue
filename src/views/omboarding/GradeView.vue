<script setup lang="ts">
import { ref, defineEmits, onMounted } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { Plus, Delete } from '@element-plus/icons-vue';
import WizardViewBase from './WizardViewBase.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loader } from "@/components/util/AppLoader.ts";
import type { Grade } from '@/types/grade';

// Étendre l'interface Grade pour inclure la propriété order
interface ExtendedGrade extends Grade {
  order: number;
}

const emit = defineEmits(['configuration-saved', 'go-back']);
const formRef = ref<FormInstance>();
const isSaving = ref(false);

const formData = ref({
  grades: [
    { name: '', code: '', order: 1 }
  ]
});

const rules: FormRules = {
  'grades.*.name': [
    { required: true, message: 'Le nom est requis', trigger: ['blur', 'change'] },
    { min: 3, max: 50, message: 'Le nom doit contenir entre 3 et 50 caractères', trigger: ['blur', 'change'] }
  ],
  'grades.*.code': [
    { required: true, message: 'Le code est requis', trigger: ['blur', 'change'] },
    { min: 2, max: 10, message: 'Le code doit contenir entre 2 et 10 caractères', trigger: ['blur', 'change'] }
  ],
  'grades.*.order': [
    { required: true, message: 'L\'ordre est requis', trigger: ['blur', 'change'] }
  ]
};

const addGrade = () => {
  const newOrder = formData.value.grades.length + 1;
  formData.value.grades.push({ name: '', code: '', order: newOrder });
};

const removeGrade = async (index: number) => {
  if (formData.value.grades.length <= 1) {
    ElMessage.warning('Vous devez avoir au moins un niveau');
    return;
  }

  try {
    await ElMessageBox.confirm(
      'Voulez-vous vraiment supprimer ce niveau ?',
      'Confirmation',
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning'
      }
    );

    formData.value.grades.splice(index, 1);
    // Réorganiser les ordres
    formData.value.grades.forEach((grade, idx) => {
      grade.order = idx + 1;
    });
    ElMessage.success('Niveau supprimé');
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Erreur lors de la suppression:', error);
    }
  }
};

const saveGrades = async () => {
  try {
    isSaving.value = true;
    Loader.showLoader("Sauvegarde des niveaux en cours...");

    // Vérifier que tous les niveaux ont un nom et un code valides
    const gradesToSave = formData.value.grades.map(grade => {
      // Nettoyer et valider les données
      const name = grade.name?.trim();
      const code = grade.code?.trim();
      const order = Number(grade.order);

      // Vérification des valeurs requises
      if (!name || !code) {
        throw new Error(`Le nom et le code sont requis pour le niveau ${order}`);
      }

      return {
        name,
        code,
        order
      };
    });

    console.log('Données à sauvegarder:', gradesToSave);

    // Vérification supplémentaire avant l'envoi
    const invalidGrades = gradesToSave.filter(grade => !grade.name || !grade.code);
    if (invalidGrades.length > 0) {
      console.error('Grades invalides:', invalidGrades);
      throw new Error('Veuillez remplir le nom et le code pour tous les niveaux');
    }

    // Vérifier la structure des données avant l'envoi
    const isValidStructure = gradesToSave.every(grade => 
      typeof grade.name === 'string' && 
      typeof grade.code === 'string' && 
      typeof grade.order === 'number' &&
      grade.name.length > 0 &&
      grade.code.length > 0
    );

    if (!isValidStructure) {
      console.error('Structure de données invalide:', gradesToSave);
      throw new Error('Structure de données invalide');
    }

    console.log('Envoi des données au service...');
    // Envoyer chaque grade individuellement pour une meilleure gestion des erreurs
    const results = await Promise.all(
      gradesToSave.map(async (grade) => {
        console.log('Envoi du grade:', grade);
        return await window.ipcRenderer.invoke('grade:new', grade);
      })
    );

    console.log('Réponses du service:', results);

    // Vérifier si toutes les opérations ont réussi
    const allSuccessful = results.every(result => result.success);
    if (allSuccessful) {
      ElMessage.success('Niveaux sauvegardés avec succès');
      return true;
    } else {
      // Trouver la première erreur
      const firstError = results.find(result => !result.success);
      console.error('Erreur du service:', firstError?.message);
      throw new Error(firstError?.message || 'Erreur lors de la sauvegarde des niveaux');
    }
  } catch (error) {
    console.error('Erreur détaillée:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    return false;
  } finally {
    isSaving.value = false;
    setTimeout(() => {
      Loader.hideLoader();
    }, 500);
  }
};

const goNext = async () => {
  if (!formRef.value) return;
  
  try {
    console.log('Début de la validation du formulaire...');
    console.log('État actuel du formulaire:', formData.value);

    // Valider le formulaire
    await formRef.value.validate();
    console.log('Validation du formulaire réussie');
    
    // Vérifier que tous les niveaux ont un nom et un code
    const invalidGrades = formData.value.grades.filter(grade => !grade.name.trim() || !grade.code.trim());
    if (invalidGrades.length > 0) {
      console.error('Grades invalides trouvés:', invalidGrades);
      ElMessage.error('Veuillez remplir le nom et le code pour tous les niveaux');
      return;
    }

    console.log('Tentative de sauvegarde des grades...');
    const saved = await saveGrades();
    if (saved) {
      console.log('Sauvegarde réussie, émission des données:', formData.value);
      emit('configuration-saved', formData.value);
    }
  } catch (error) {
    console.error('Erreur de validation détaillée:', error);
    ElMessage.error('Veuillez corriger les erreurs dans le formulaire.');
  }
};

const goBack = () => {
  emit('go-back');
};

// Charger les niveaux existants au montage
onMounted(async () => {
  try {
    isSaving.value = true;
    Loader.showLoader("Chargement des niveaux...");
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result.success) {
      formData.value.grades = result.data.map((grade: ExtendedGrade) => ({
        name: grade.name,
        code: grade.code,
        order: grade.order
      }));
    } else {
      throw new Error(result.message || "Échec du chargement des niveaux");
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue");
    console.error("Erreur lors du chargement des niveaux:", error);
  } finally {
    isSaving.value = false;
    Loader.hideLoader();
  }
});
</script>

<template>
  <wizard-view-base>
    <template #title>
      Configurez les niveaux d'études de votre établissement.
    </template>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="grade-form"
      status-icon
      validate-on-rule-change="false"
    >
      <div class="grades-container">
        <div v-for="(grade, index) in formData.grades" :key="index" class="grade-item">
          <el-form-item 
            :prop="`grades.${index}.name`"
            label="Nom du niveau"
            required
          >
            <el-input 
              v-model="grade.name" 
              placeholder="Ex: Sixième A, Cinquième B, etc."
              class="grade-name"
              @blur="() => {
                console.log('Validation du nom:', grade.name);
                formRef?.validateField(`grades.${index}.name`);
              }"
            />
          </el-form-item>

          <el-form-item 
            :prop="`grades.${index}.code`"
            label="Code du niveau"
            required
          >
            <el-input 
              v-model="grade.code" 
              placeholder="Ex: 6A, 5B, etc."
              class="grade-code"
              @blur="() => {
                console.log('Validation du code:', grade.code);
                formRef?.validateField(`grades.${index}.code`);
              }"
            />
          </el-form-item>

          <el-form-item 
            :prop="`grades.${index}.order`"
            label="Ordre"
            required
          >
            <el-input-number 
              v-model="grade.order" 
              :min="1" 
              :max="20" 
              class="grade-order"
            />
          </el-form-item>

          <el-button
            type="danger"
            circle
            @click="removeGrade(index)"
            :icon="Delete"
            class="remove-grade"
          />
        </div>
        <el-button type="primary" @click="addGrade" class="add-grade">
          <el-icon><Plus /></el-icon>
          Ajouter un niveau
        </el-button>
      </div>
    </el-form>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        :loading="isSaving"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.grade-form {
  width: 100%;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.grades-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.grade-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  transition: all 0.3s ease;
}

.grade-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.grade-name {
  flex: 1;
}

.grade-code {
  width: 150px;
}

.grade-order {
  width: 120px;
}

.remove-grade {
  flex-shrink: 0;
  margin-top: 32px;
}

.add-grade {
  margin-top: 10px;
  width: 100%;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-form-item.is-required .el-form-item__label::before) {
  content: '*';
  color: var(--el-color-danger);
  margin-right: 4px;
}

:deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

:deep(.el-form-item__error) {
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1;
  padding-top: 4px;
  position: absolute;
  top: 100%;
  left: 0;
}

/* Responsive styles */
@media (max-width: 768px) {
  .grade-item {
    flex-direction: column;
    gap: 15px;
  }

  .grade-name,
  .grade-code,
  .grade-order {
    width: 100%;
  }

  .remove-grade {
    margin-top: 0;
    align-self: flex-end;
  }
}
</style>
