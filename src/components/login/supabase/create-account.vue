<template>
  <div class="create-account">
    <el-card class="box-card" shadow="hover">
      <template #header>
        <span>Activer la sauvegarde Cloud</span>
      </template>

      <div v-if="schoolInfo.email">
        <p>
          📬 Adresse e-mail détectée : <strong>{{ schoolInfo.email }}</strong>
        </p>
        <p class="instruction">
          Cette adresse sera utilisée pour créer un compte sécurisé dans le cloud Supabase.
        </p>

        <el-form
          :model="form"
          ref="formRef"
          :rules="rules"
          label-position="top"
          size="large"
          class="account-form"
        >
          <el-form-item label="Mot de passe" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="Entrez un mot de passe"
            />
          </el-form-item>

          <el-form-item label="Confirmer le mot de passe" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              show-password
              placeholder="Confirmez le mot de passe"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :loading="isSubmitting" @click="handleSubmit">
              Créer le compte Cloud
            </el-button>
          </el-form-item>
        </el-form>

        <el-alert
          type="info"
          title="Une fois connecté, vos données pourront être sauvegardées automatiquement sur le cloud."
          show-icon
          :closable="false"
        />
      </div>

      <div v-else>
        <el-alert
          type="warning"
          title="Aucune adresse e-mail trouvée. Veuillez configurer l’école dans les paramètres d’abord."
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

interface ISchoolData {
  id?: number;
  name: string;
  address: string;
  town: string;
  country: string;
  phone: string;
  email: string;
  type: string;
  foundationYear: number;
  logo: any;
}

const initialSchoolInfo: ISchoolData = {
  id: undefined,
  name: '',
  address: '',
  town: '',
  country: 'SN',
  phone: '',
  email: '',
  type: 'publique',
  foundationYear: new Date().getFullYear(),
  logo: null
};

const schoolInfo = ref<ISchoolData>({ ...initialSchoolInfo });
const isSubmitting = ref(false);

const form = ref({
  password: '',
  confirmPassword: ''
});

const rules = {
  password: [
    { required: true, message: 'Mot de passe requis', trigger: 'blur' },
    { min: 6, message: 'Minimum 6 caractères', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      required: true,
      message: 'Confirmez le mot de passe',
      trigger: 'blur'
    },
    {
      validator: (_: any, value: string, callback: any) => {
        if (value !== form.value.password) {
          callback(new Error('Les mots de passe ne correspondent pas'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

const formRef = ref();

const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result?.success && result.data) {
      schoolInfo.value = {
        ...initialSchoolInfo,
        ...result.data
      };
    } else {
      ElMessage.warning('Aucune information d\'école trouvée');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('Erreur lors du chargement des informations');
  }
};

const handleSubmit = async () => {
  await formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;

    isSubmitting.value = true;
    try {
      const { email } = schoolInfo.value;
      const { password } = form.value;

      const result = await window.ipcRenderer.invoke('auth:createSupabaseAccount', {
        email,
        password
      });

      if (result.success) {
        
        emit('account-created', result.data);
      } else {
        ElMessage.error(`Erreur: ${result.error || 'Échec de la création du compte'}`);
      }
    } catch (error) {
      console.error('Erreur création compte:', error);
      ElMessage.error('Erreur lors de la création du compte cloud');
    } finally {
      isSubmitting.value = false;
    }
  });
};

// Ajouter un emitter pour la création réussie
const emit = defineEmits<{
  (e: 'account-created', user: any): void
}>();

onMounted(loadSchoolInfo);
</script>

<style scoped>
.create-account {
  max-width: 600px;
  margin: 40px auto;
}
.account-form {
  margin-top: 20px;
}
.instruction {
  margin-top: 10px;
  margin-bottom: 20px;
  color: #606266;
}
</style>
