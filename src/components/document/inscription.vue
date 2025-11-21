<template>
  <div class="document-preview-wrapper">
    <!-- Si du contenu HTML personnalisé est fourni, on l'affiche tel quel -->
    <div
      v-if="content"
      class="certificate-card"
      :contenteditable="editable ? 'true' : undefined"
      v-html="processedContent"
    ></div>

    <!-- Sinon on affiche un modèle par défaut construit à partir des infos école/élève -->
    <div
      v-else
      class="certificate-card"
      :contenteditable="editable ? 'true' : undefined"
    >
      <!-- En-tête avec logo et informations de l'école -->
      <div class="header">
        <div class="school-header">
          <div class="logo-block">
            <img v-if="logoUrl" :src="logoUrl" alt="Logo de l'école" class="school-logo" />
          </div>
          <div class="school-info">
            <h1 class="school-name">{{ schoolInfo?.name || 'Nom de l\'école' }}</h1>
            <p v-if="schoolInfo?.address" class="school-line">{{ schoolInfo.address }}</p>
            <p v-if="schoolInfo?.town || schoolInfo?.country" class="school-line">
              {{ [schoolInfo?.town, schoolInfo?.country].filter(Boolean).join(' - ') }}
            </p>
            <p v-if="schoolInfo?.phone" class="school-line">Tél : {{ schoolInfo.phone }}</p>
            <p v-if="schoolInfo?.email" class="school-line">Email : {{ schoolInfo.email }}</p>
          </div>
        </div>
        <h2 class="document-title">CERTIFICAT D'INSCRIPTION</h2>
      </div>

      <!-- Contenu principal -->
      <div class="body">
        <div class="paragraph">
          <p>
            Je soussigné(e),
            <strong contenteditable="false">
              {{ schoolInfo?.directorName || '[Nom du directeur]' }}
            </strong>,
            directeur de l'établissement
            <strong contenteditable="false">
              {{ schoolInfo?.name || 'Nom de l\'école' }}
            </strong>, certifie que :
          </p>
        </div>
        
        <div class="field">
          <span class="label">Nom :</span>
          <span class="value" contenteditable="false">
            {{ student?.lastName || '[Nom]' }}
          </span>
        </div>
        <div class="field">
          <span class="label">Prénom :</span>
          <span class="value" contenteditable="false">
            {{ student?.firstName || '[Prénom]' }}
          </span>
        </div>
        <div class="field">
          <span class="label">Né(e) le :</span>
          <span class="value" contenteditable="false">
            {{ formatDate(student?.birthDate) || '[Date de naissance]' }}
          </span>
        </div>
        <div class="field">
          <span class="label">À :</span>
          <span class="value" contenteditable="false">
            {{ student?.birthPlace || '[Lieu de naissance]' }}
          </span>
        </div>
        
        <div class="paragraph">
          <p>
            a été inscrit(e) en classe de
            <strong contenteditable="false">
              {{ student?.grade?.name || '[Classe]' }}
            </strong>
            pour l'année scolaire
            <strong contenteditable="false">
              {{ academicYear || '[Année scolaire]' }}
            </strong>.
          </p>
          <p>L'établissement est situé à l'adresse suivante :</p>
          <p class="school-address">
            <span contenteditable="false">
              {{ schoolInfo?.address || '[Adresse de l\'école]' }}
            </span><br>
            <span contenteditable="false">
              {{ [schoolInfo?.town, schoolInfo?.country].filter(Boolean).join(' - ') || '[Ville - Pays]' }}
            </span>
          </p>
          <p>
            Numéro de téléphone :
            <span contenteditable="false">
              {{ schoolInfo?.phone || '[Téléphone]' }}
            </span>
          </p>
          <p>
            Email :
            <span contenteditable="false">
              {{ schoolInfo?.email || '[Email]' }}
            </span>
          </p>
        </div>

        <div class="paragraph">
          <p>Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.</p>
        </div>

        <div class="signature-row">
          <div class="date">
            Fait à
            <span contenteditable="false">
              {{ schoolInfo?.town || '[Ville]' }}
            </span>,
            le
            <span contenteditable="false">
              {{ currentDate }}
            </span>
          </div>
          <div class="director">
            <div>Le Directeur</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  content: {
    type: String,
    required: false,
    default: ''
  },
  logoUrl: {
    type: String,
    default: ''
  },
  editable: {
    type: Boolean,
    default: false
  },
  schoolInfo: {
    type: Object,
    default: () => ({
      name: '',
      address: '',
      town: '',
      country: '',
      phone: '',
      email: '',
      logo: null
    })
  },
  student: {
    type: Object,
    default: () => ({
      firstName: '',
      lastName: '',
      birthDate: null,
      birthPlace: '',
      grade: {}
    })
  },
  academicYear: {
    type: String,
    default: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
  }
});

const currentDate = computed(() => {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return new Date().toLocaleDateString('fr-FR', options);
});

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '';
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return new Date(dateString).toLocaleDateString('fr-FR', options);
};

const processedContent = computed(() => {
  if (!props.content) return '';
  
  let processed = props.content;
  const student = props.student || {};
  const school = props.schoolInfo || {};
  
  // Injecter l'en-tête si manquant (pour les anciens templates)
  if (!processed.includes('school-header')) {
    const headerTemplate = `
<div class="header" contenteditable="false">
  <div class="school-header">
    <div class="logo-block">
      <img src="{{logo_url}}" alt="Logo" class="school-logo" />
    </div>
    <div class="school-info">
      <h1 class="school-name">{{nom_ecole}}</h1>
      <p class="school-line">{{adresse_ecole}}</p>
      <p class="school-line">{{ville_pays}}</p>
      <p class="school-line">Tél : {{telephone_ecole}}</p>
      <p class="school-line">Email : {{email_ecole}}</p>
    </div>
  </div>
  <h2 class="document-title">ATTESTATION D'INSCRIPTION</h2>
</div>`;
    
    // Si l'ancien header existe, on le remplace, sinon on ajoute le nouveau au début
    if (processed.includes('<div class="header">')) {
       // Simple remplacement de l'ancien bloc header par le nouveau
       // Attention: cela suppose une structure simple. Pour plus de sûreté, on peut juste prepend et laisser l'utilisateur nettoyer si besoin,
       // ou essayer de remplacer intelligemment.
       // Ici, on va remplacer le titre simple s'il est trouvé, sinon prepend.
       processed = processed.replace(/<div class="header">[\s\S]*?<\/div>/, headerTemplate);
    } else {
       processed = headerTemplate + processed;
    }
  }

  const getVal = (val: any, placeholder: string) => {
    if (val) return val;
    if (props.editable) return placeholder;
    return '';
  };
  
  const replacements: Record<string, string> = {
    '{{logo_url}}': getVal(props.logoUrl, ''),
    '{{nom_directeur}}': getVal((school as any).directorName, '{{nom_directeur}}'),
    '{{nom_ecole}}': getVal(school.name, '{{nom_ecole}}'),
    '{{adresse_ecole}}': getVal(school.address, '{{adresse_ecole}}'),
    '{{telephone_ecole}}': getVal(school.phone, '{{telephone_ecole}}'),
    '{{email_ecole}}': getVal(school.email, '{{email_ecole}}'),
    '{{ville_pays}}': getVal([school.town, school.country].filter(Boolean).join(' - '), '{{ville_pays}}'),
    '{{nom_eleve}}': getVal(student.lastname, '{{nom_eleve}}'),
    '{{prenom_eleve}}': getVal(student.firstname, '{{prenom_eleve}}'),
    '{{date_naissance_eleve}}': getVal(formatDate(student.birthDay), '{{date_naissance_eleve}}'),
    '{{lieu_naissance_eleve}}': getVal(student.birthPlace, '{{lieu_naissance_eleve}}'),
    '{{programme}}': getVal(student.grade?.name, '{{programme}}'),
    '{{annee_scolaire}}': getVal(props.academicYear || student.schoolYear, '{{annee_scolaire}}'),
    '{{campus}}': getVal(school.town, '{{campus}}'),
    '{{ville}}': getVal(school.town, '{{ville}}'),
    '{{date_jour}}': getVal(currentDate.value, '{{date_jour}}')
  };

  Object.entries(replacements).forEach(([key, value]) => {
    processed = processed.replace(new RegExp(key, 'g'), value);
  });

  return processed;
});
</script>

<style scoped>
.document-preview-wrapper {
  background: white;
  width: 21cm;
  min-height: 29.7cm;
  margin: 0 auto;
  padding: 2cm;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  position: relative;
  box-sizing: border-box;
  font-family: 'Times New Roman', Times, serif;
  line-height: 1.6;
  color: #333;
}

:deep(.certificate-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.header) {
  margin-bottom: 2rem;
}

:deep(.school-header) {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

:deep(.logo-block) {
  flex: 0 0 auto;
}

:deep(.school-logo) {
  max-width: 90px;
  max-height: 90px;
}

:deep(.school-info) {
  flex: 1;
}

:deep(.school-name) {
  font-size: 1.4rem;
  margin: 0 0 0.4rem 0;
  font-weight: bold;
  text-transform: uppercase;
}

:deep(.school-line) {
  margin: 0.1rem 0;
  font-size: 0.9rem;
}

:deep(.document-title) {
  font-size: 1.8rem;
  margin: 1.5rem 0;
  text-transform: uppercase;
  font-weight: bold;
  text-decoration: underline;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #000;
  display: inline-block;
}

:deep(.body) {
  flex: 1;
  padding: 0 2rem;
}

:deep(.field) {
  display: flex;
  margin-bottom: 0.8rem;
}

:deep(.label) {
  min-width: 100px;
  font-weight: bold;
}

:deep(.value) {
  flex: 1;
  border-bottom: 1px solid #ddd;
  padding-left: 10px;
}

:deep(.paragraph) {
  margin: 1.5rem 0;
  text-align: justify;
  line-height: 1.8;
}

:deep(.school-address) {
  margin: 1rem 0;
  padding: 0.8rem;
  background-color: #f9f9f9;
  border-left: 3px solid #409EFF;
}

:deep(.signature-row) {
  margin-top: 4rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

:deep(.date) {
  text-align: left;
  flex: 1;
}

:deep(.director) {
  text-align: right;
  flex: 1;
}

:deep(.signature-space) {
  margin-top: 3rem;
  min-height: 2rem;
  border-top: 1px solid #000;
  display: inline-block;
  min-width: 200px;
  text-align: center;
  padding-top: 0.5rem;
}

/* Zones figées auto-remplies (nom élève, dates, etc.) - Uniquement en mode édition */
:deep(.certificate-card[contenteditable="true"] [contenteditable="false"]) {
  background-color: #f5f7fa;
  border-radius: 2px;
  padding: 0 2px;
  color: #606266;
  cursor: not-allowed;
}

/* Styles pour les champs éditables */
:deep([contenteditable="true"]) {
  min-width: 100px;
  display: inline-block;
  border-bottom: 1px dashed #999;
  padding: 0 5px;
  min-height: 1.2em;
}

:deep([contenteditable="true"]:focus) {
  outline: 1px solid #409EFF;
  background-color: #f0f7ff;
}

/* Impression */
@media print {
  .document-preview-wrapper {
    box-shadow: none;
    padding: 0;
    width: 210mm;
    height: 296mm; /* Légèrement moins que 297mm pour éviter le débordement */
    margin: 0;
    overflow: hidden; /* Évite la 2ème page si dépassement mineur */
  }
  
  :deep(.certificate-card) {
    padding: 15mm; /* Marges internes pour l'impression */
  }

  :deep(.no-print) {
    display: none !important;
  }
  
  @page {
    size: A4;
    margin: 0;
  }
}
</style>
