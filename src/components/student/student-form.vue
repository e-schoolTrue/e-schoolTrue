<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';

// Définir les types pour les props
interface StudentData {
  firstname: string;   // Changer 'name' à 'firstname'
  lastname: string;    // Ajouter 'lastname'
  birthDay: Date | null; // Changer 'birthDate' à 'birthDay'
  birthPlace: string; // Ajout du champ birthPlace
  address: string;
  classId: number | null;
  fatherFirstname?: string; // Ajout des noms de père et mère
  fatherLastname?: string;
  motherFirstname?: string;
  motherLastname?: string;
  famillyPhone: string;
  personalPhone:string;
  photo?: File | null; 
}

interface ClassItem {
  id: number;
  name: string;
}

// Définir les props avec leurs types
const props = defineProps<{
  studentData: StudentData;
  classes: ClassItem[];
}>();

const emit = defineEmits(['save']);

// État de l'étape actuelle
const currentStep = ref(0);

// État des données de formulaire
const firstname = ref(props.studentData.firstname);
const lastname = ref(props.studentData.lastname);
const birthDay = ref(props.studentData.birthDay);
const birthPlace = ref(props.studentData.birthPlace || ''); 
const  address = ref(props.studentData. address);
const personalPhone = ref(props.studentData.personalPhone);
const classId = ref(props.studentData.classId);
const photo = ref<File | null>(null);

// Informations des parents et autres données
const fatherFirstname = ref('');
const fatherLastname = ref('');
const motherFirstname = ref('');
const motherLastname = ref('');
const famillyPhone = ref('');
const schoolInfo = ref('');
const documents = ref(null);

// Gérer les étapes "Suivant" et "Précédent"
const nextStep = () => {
  if (currentStep.value < 3) {
    currentStep.value += 1;
  }
};
const classes = ref([
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
  { id: 4, name: 'DEF' },
]);

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value -= 1;
  }
};

// Sauvegarder les données au dernier step
const saveData = () => {
  const studentData = {
    firstname: firstname.value,
    lastname: lastname.value,
    birthDay: birthDay.value,
    birthPlace: birthPlace.value, 
    address:  address.value,
    classId: classId.value,
    personalPhone: personalPhone.value,
    fatherFirstname: fatherFirstname.value, // Ajout des informations sur le père
    fatherLastname: fatherLastname.value,
    motherFirstname: motherFirstname.value, // Ajout des informations sur la mère
    motherLastname: motherLastname.value,
    famillyPhone: famillyPhone.value,
    schoolInfo: schoolInfo.value,
    documents: documents.value
  };
  emit('save', studentData);
};
const handlePhotoUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    photo.value = target.files[0];
  }
};
</script>

<template>
  <el-card>
    <el-form style="width: 100%">
      <el-space direction="vertical" fill="fill" size="small" style="width: 100%">
        <el-steps :space="300" :active="currentStep" finish-status="success">
          <el-step title="Informations personnelles" />
          <el-step title="Informations des Parents" />
          <el-step title="Informations Scolaires" />
          <el-step title="Pièces jointes" />
        </el-steps>

        <!-- Section 1 : Informations personnelles -->
        <div v-if="currentStep === 0">
          <el-form-item label="Nom">
            <el-input v-model="lastname"></el-input> 
          </el-form-item>

          <el-form-item label="Prénom">
            <el-input v-model="firstname"></el-input> 
          </el-form-item>

          <el-form-item label="Date de naissance">
            <el-date-picker v-model="birthDay" type="date"></el-date-picker> 
          </el-form-item>
          <el-form-item label="Lieu de Naissance">
            <el-input v-model="birthPlace"></el-input> 
          </el-form-item>
          <el-form-item label="Adresse">
            <el-input v-model="address"></el-input>
          </el-form-item>
          <el-form-item label="Contact de l'élève">
            <el-input v-model="personalPhone"></el-input>
          </el-form-item>
          <el-form-item label="Classe">
            <el-select v-model="classId">
              <el-option
                v-for="item in classes"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          
        </div>

        <!-- Section 2 : Informations des Parents -->
        <div v-if="currentStep === 1">
          <el-form-item label="Prénom du Père">
            <el-input v-model="fatherFirstname"></el-input> <!-- Ajouter input pour prénom du père -->
          </el-form-item>

          <el-form-item label="Nom du Père">
            <el-input v-model="fatherLastname"></el-input> <!-- Ajouter input pour nom de famille du père -->
          </el-form-item>

          <el-form-item label="Prénom de la Mère">
            <el-input v-model="motherFirstname"></el-input> <!-- Ajouter input pour prénom de la mère -->
          </el-form-item>

          <el-form-item label="Nom de la Mère">
            <el-input v-model="motherLastname"></el-input> <!-- Ajouter input pour nom de famille de la mère -->
          </el-form-item>

          <el-form-item label="Contact du Parent">
            <el-input v-model="famillyPhone"></el-input>
          </el-form-item>
        </div>

        <!-- Section 3 : Informations Scolaires -->
        <div v-if="currentStep === 2">
          <el-form-item label="Informations Scolaires">
            <el-input v-model="schoolInfo"></el-input>
          </el-form-item>
        </div>

        <!-- Section 4 : Pièces jointes -->
        <div v-if="currentStep === 3">
          <el-form-item label="Photo">
          <el-upload
            action="#"
            :auto-upload="false"
            :on-change="handlePhotoUpload"
            :limit="1"
          >
            <el-button type="primary">Sélectionner une photo</el-button>
          </el-upload>
        </el-form-item>

          <el-form-item label="Pièces jointes">
            <el-upload v-model="documents" action="">
              <el-button type="primary">Selectionner document Scolaire</el-button>
            </el-upload>
          </el-form-item>
        </div>

        <!-- Boutons Précédent et Suivant -->
        <el-form-item>
          <el-button v-if="currentStep > 0" type="info" @click="previousStep">Précédent</el-button>
          <el-button v-if="currentStep < 3" type="primary" @click="nextStep">Suivant</el-button>
          <el-button v-if="currentStep === 3" type="success" @click="saveData">Sauvegarder</el-button>
        </el-form-item>
      </el-space>
    </el-form>
  </el-card>
</template>

<style scoped></style>
