<template>
  <div class="login-account">
    <el-card class="box-card" shadow="hover">
      <template #header>
        <span>Connexion au compte Cloud</span>
      </template>

      <div v-if="schoolInfo.email">
        <p>📬 Adresse détectée : <strong>{{ schoolInfo.email }}</strong></p>
        <p class="instruction">
          Entrez votre mot de passe pour vous connecter et activer la sauvegarde cloud.
        </p>

        <el-form
          :model="form"
          ref="formRef"
          :rules="rules"
          label-position="top"
          size="large"
          class="login-form"
        >
          <el-form-item label="Mot de passe" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="Mot de passe"
            />
          </el-form-item>

          <el-form-item>
            <el-button 
              type="primary" 
              :loading="isSubmitting" 
              @click="handleLogin"
              class="login-button"
            >
              Se connecter
            </el-button>
          </el-form-item>
        </el-form>

        <el-alert
          type="info"
          title="Connexion requise pour activer les sauvegardes cloud automatiques."
          show-icon
          :closable="false"
        />
      </div>

      <div v-else>
        <el-alert
          type="warning"
          title="Adresse e-mail manquante. Veuillez configurer l’école d’abord."
          show-icon
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
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
  password: ''
});

const rules = {
  password: [
    { required: true, message: 'Mot de passe requis', trigger: 'blur' },
    { min: 6, message: 'Minimum 6 caractères', trigger: 'blur' }
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

const handleLogin = async () => {
  await formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return;

    isSubmitting.value = true;
    try {
      const { email } = schoolInfo.value;
      const { password } = form.value;

      const result = await window.ipcRenderer.invoke('auth:loginSupabase', {
        email,
        password
      });

      if (result.success) {
        ElMessage.success('Connexion au compte cloud réussie !');
        emit('login-success', result.data);
      } else {
        ElMessage.error(`Erreur: ${result.error || 'Échec de la connexion'}`);
      }
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      ElMessage.error('Erreur lors de la connexion au compte cloud');
    } finally {
      isSubmitting.value = false;
    }
  });
};

// Ajout d'émetteurs d'événements
const emit = defineEmits<{
  (e: 'login-success', user: any): void
}>();

onMounted(loadSchoolInfo);
</script>

<style scoped>
.login-account {
  max-width: 600px;
  margin: 40px auto;
}
.login-form {
  margin-top: 20px;
}
.instruction {
  margin-top: 10px;
  margin-bottom: 20px;
  color: #606266;
}
</style>
