<script setup lang="ts">
import { ref, reactive } from 'vue';
import { CIVILITY, FAMILY_SITUATION, ROLE, SCHOOL_TYPE } from "#electron/command";
import type { UploadProps, UploadUserFile } from 'element-plus';
import { ElMessage } from 'element-plus';
import TeachingAssignment from './sections/TeachingAssignment.vue';
import { useRouter } from 'vue-router';

interface ProfessorFormData {
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
    diploma: {
        name: string;
    };
    qualification: {
        name: string;
    };
    user: {
        username: string;
        password: string;
        role: ROLE;
    };
    documents: Array<{
        name: string;
        content: string;
        type: string;
    }>;
    photo?: {
        name: string;
        content: string;
        type: string;
    };
    teaching?: {
        teachingType: string;
        schoolType: SCHOOL_TYPE | null;
        classId?: number;
        courseId?: number | null;
        gradeIds?: string;
    };
    schoolType: SCHOOL_TYPE | null;
    selectedClasses: number[];
    selectedCourse: number | null;
}

const props = defineProps<{
    disabled?: boolean;
    initialData?: ProfessorFormData;
}>();

const emit = defineEmits<{
    (e: 'save', data: ProfessorFormData): Promise<boolean>;
}>();

const router = useRouter();

const currentStep = ref(0);
const imageUrl = ref('');

const schoolType = ref<SCHOOL_TYPE | null>(null);
const selectedClasses = ref<number[]>([]);
const selectedCourse = ref<number | null>(null);

const formData = reactive<ProfessorFormData>({
    firstname: '',
    lastname: '',
    civility: CIVILITY.MR,
    nbr_child: 0,
    family_situation: FAMILY_SITUATION.SINGLE,
    birth_date: null,
    birth_town: '',
    address: '',
    town: '',
    cni_number: '',
    diploma: { name: '' },
    qualification: { name: '' },
    user: {
        username: '',
        password: '',
        role: ROLE.professor
    },
    documents: [],
    photo: undefined,
    schoolType: null,
    selectedClasses: [],
    selectedCourse: null
});

// Options pour les listes déroulantes
const civilityOptions = [
    { label: 'Monsieur', value: CIVILITY.MR },
    { label: 'Madame', value: CIVILITY.MME },
    { label: 'Mademoiselle', value: CIVILITY.MLLE }
];

const familySituationOptions = [
    { label: 'Célibataire', value: FAMILY_SITUATION.SINGLE },
    { label: 'Marié(e)', value: FAMILY_SITUATION.MARRIED },
    { label: 'Divorcé(e)', value: FAMILY_SITUATION.DIVORCED },
    { label: 'Veuf/Veuve', value: FAMILY_SITUATION.WIDOWED }
];

// Gestion des fichiers

const beforeAvatarUpload: UploadProps['beforeUpload'] = (rawFile) => {
    if (rawFile.type !== 'image/jpeg' && rawFile.type !== 'image/png') {
        ElMessage.error('L\'avatar doit être au format JPG ou PNG!');
        return false;
    }
    if (rawFile.size / 1024 / 1024 > 2) {
        ElMessage.error('L\'avatar ne doit pas dépasser 2MB!');
        return false;
    }
    return true;
};

const handlePhotoChange = (file: UploadUserFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        if (e.target?.result) {
            formData.photo = {
                name: file.name,
                content: e.target.result as string,
                type: file.raw?.type || 'image/jpeg'
            };
            imageUrl.value = e.target.result as string;
        }
    };
    if (file.raw) {
        reader.readAsDataURL(file.raw);
    }
};

const handleDocumentChange = (file: UploadUserFile) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        if (e.target?.result && formData.documents) {
            formData.documents.push({
                name: file.name,
                content: e.target.result as string,
                type: file.raw?.type || 'application/octet-stream'
            });
        }
    };
    if (file.raw) {
        reader.readAsDataURL(file.raw);
    }
};

const handleRemove = (file: UploadUserFile) => {
    if (formData.documents) {
        const index = formData.documents.findIndex(doc => doc.name === file.name);
        if (index !== -1) {
            formData.documents.splice(index, 1);
        }
    }
};

const nextStep = () => {
    if (currentStep.value < steps.length - 1) currentStep.value++;
};

const previousStep = () => {
    if (currentStep.value > 0) currentStep.value--;
};

const handleSchoolTypeChange = () => {
    // Réinitialiser les sélections lors du changement de type d'école
    selectedClasses.value = [];
    selectedCourse.value = null;
};

const validateTeachingAssignment = () => {
    if (!schoolType.value) {
        ElMessage.error('Veuillez sélectionner un type d\'école');
        return false;
    }

    if (schoolType.value === SCHOOL_TYPE.PRIMARY) {
        if (selectedClasses.value.length !== 1) {
            ElMessage.error('Veuillez sélectionner une classe pour l\'instituteur');
            return false;
        }
    } else {
        if (!selectedCourse.value) {
            ElMessage.error('Veuillez sélectionner une matière');
            return false;
        }
        if (selectedClasses.value.length === 0) {
            ElMessage.error('Veuillez sélectionner au moins une classe');
            return false;
        }
    }

    return true;
};

const saveData = async () => {
    if (currentStep.value === 4 && !validateTeachingAssignment()) {
        return;
    }

    try {
        // Créer l'objet d'affectation
        const teachingData = currentStep.value === 4 ? {
            teachingType: schoolType.value === SCHOOL_TYPE.PRIMARY ? 'CLASS_TEACHER' : 'SUBJECT_TEACHER',
            schoolType: schoolType.value,
            classId: schoolType.value === SCHOOL_TYPE.PRIMARY ? selectedClasses.value[0] : undefined,
            courseId: schoolType.value === SCHOOL_TYPE.SECONDARY ? selectedCourse.value : undefined,
            gradeIds: schoolType.value === SCHOOL_TYPE.SECONDARY ? selectedClasses.value.join(',') : undefined
        } : undefined;

        console.log("Données d'affectation à envoyer:", teachingData); // Log de debug

        const completeData = {
            ...formData,
            teaching: teachingData,
            schoolType: schoolType.value,
            selectedClasses: selectedClasses.value,
            selectedCourse: selectedCourse.value
        };

        const result = await emit('save', completeData);
        if (result) {
            ElMessage.success('Professeur enregistré avec succès');
            router.push('/professor');
        }
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        ElMessage.error('Erreur lors de la sauvegarde');
    }
};

// Initialisation avec les données existantes si fournies
if (props.initialData) {
    Object.assign(formData, props.initialData);
    if (props.initialData.photo) {
        imageUrl.value = props.initialData.photo.content;
    }
}

// Modifier les étapes
const steps = [
    { title: 'Informations personnelles' },
    { title: 'Situation familiale' },
    { title: 'Qualifications' },
    { title: 'Documents' },
    { title: 'Affectation' }
];
</script>

<template>
    <el-card class="professor-form">
        <el-steps :active="currentStep" finish-status="success" align-center class="mb-4">
            <el-step v-for="step in steps" :key="step.title" :title="step.title" />
        </el-steps>

        <el-form :model="formData" label-position="top">
            <!-- Étape 1: Informations personnelles -->
            <div v-if="currentStep === 0">
                <el-row :gutter="20">
                    <el-col :span="8">
                        <el-form-item label="Civilité">
                            <el-select 
                                v-model="formData.civility"
                                placeholder="Sélectionnez une civilité"
                                class="w-full"
                            >
                                <el-option
                                    v-for="option in civilityOptions"
                                    :key="option.value"
                                    :label="option.label"
                                    :value="option.value"
                                />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="8">
                        <el-form-item label="Nom">
                            <el-input v-model="formData.lastname" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="8">
                        <el-form-item label="Prénom">
                            <el-input v-model="formData.firstname" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="Date de naissance">
                            <el-date-picker
                                v-model="formData.birth_date"
                                type="date"
                                placeholder="Sélectionnez une date"
                            />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="Lieu de naissance">
                            <el-input v-model="formData.birth_town" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="Adresse">
                            <el-input v-model="formData.address" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="Ville">
                            <el-input v-model="formData.town" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-form-item label="Numéro CNI">
                    <el-input v-model="formData.cni_number" />
                </el-form-item>
            </div>

            <!-- Étape 2: Situation familiale -->
            <div v-if="currentStep === 1">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="Situation familiale">
                            <el-select 
                                v-model="formData.family_situation"
                                placeholder="Sélectionnez une situation"
                                class="w-full"
                            >
                                <el-option
                                    v-for="option in familySituationOptions"
                                    :key="option.value"
                                    :label="option.label"
                                    :value="option.value"
                                />
                            </el-select>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="Nombre d'enfants">
                            <el-input-number v-model="formData.nbr_child" :min="0" />
                        </el-form-item>
                    </el-col>
                </el-row>

                <el-row :gutter="20">
                    <el-col :span="8">
                        <el-form-item label="Nom d'utilisateur">
                            <el-input v-model="formData.user.username" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="8">
                        <el-form-item label="Mot de passe">
                            <el-input v-model="formData.user.password" type="password" />
                        </el-form-item>
                    </el-col>
                </el-row>
            </div>

            <!-- Étape 3: Qualifications -->
            <div v-if="currentStep === 2">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="Diplôme">
                            <el-input v-model="formData.diploma.name" />
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="Qualification">
                            <el-input v-model="formData.qualification.name" />
                        </el-form-item>
                    </el-col>
                </el-row>
            </div>

            <!-- Étape 4: Documents -->
            <div v-if="currentStep === 3">
                <el-row :gutter="20">
                    <el-col :span="12">
                        <el-form-item label="Photo">
                            <el-upload
                                class="avatar-uploader"
                                action="#"
                                :show-file-list="false"
                                :on-change="handlePhotoChange"
                                :before-upload="beforeAvatarUpload"
                                :auto-upload="false"
                            >
                                <img v-if="imageUrl" :src="imageUrl" class="avatar" />
                                <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
                            </el-upload>
                        </el-form-item>
                    </el-col>
                    <el-col :span="12">
                        <el-form-item label="Documents">
                            <el-upload
                                action="#"
                                :on-change="handleDocumentChange"
                                :on-remove="handleRemove"
                                :auto-upload="false"
                                multiple
                            >
                                <el-button type="primary">Cliquez pour uploader</el-button>
                                <template #tip>
                                    <div class="el-upload__tip">
                                        Documents au format PDF, DOC, DOCX
                                    </div>
                                </template>
                            </el-upload>
                        </el-form-item>
                    </el-col>
                </el-row>
            </div>

            <!-- Étape 5: Affectation -->
            <div v-if="currentStep === 4">
                <teaching-assignment 
                    v-model:school-type="schoolType"
                    v-model:selected-classes="selectedClasses"
                    v-model:selected-course="selectedCourse"
                    @school-type-change="handleSchoolTypeChange"
                />
            </div>

            <div class="form-actions">
                <el-button 
                    v-if="currentStep > 0" 
                    @click="previousStep"
                >
                    Précédent
                </el-button>

                <el-button 
                    v-if="currentStep < steps.length - 1" 
                    type="primary" 
                    @click="nextStep"
                >
                    Suivant
                </el-button>

                <el-button 
                    v-if="currentStep === steps.length - 1" 
                    type="success" 
                    @click="saveData"
                    :loading="disabled"
                >
                    Terminer
                </el-button>
            </div>
        </el-form>
    </el-card>
</template>

<style scoped>
.professor-form {
    max-width: 800px;
    margin: 0 auto;
}

.form-actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.mb-4 {
    margin-bottom: 1rem;
}

.avatar-uploader {
    border: 1px dashed var(--el-border-color);
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: var(--el-transition-duration-fast);
}

.avatar-uploader:hover {
    border-color: var(--el-color-primary);
}

.avatar-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 178px;
    height: 178px;
    text-align: center;
}

.avatar {
    width: 178px;
    height: 178px;
    display: block;
}

.w-full {
    width: 100%;
}

:deep(.el-select) {
    width: 100%;
}

:deep(.el-select .el-input__wrapper) {
    width: 100%;
}
</style>