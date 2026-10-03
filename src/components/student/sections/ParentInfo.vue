<template>
  <div>
    <h3>Informations sur les parents/tuteurs</h3>

    <!-- Recherche foyer existant (Option B Table Parent) -->
    <el-form-item label="Rechercher un foyer existant">
      <el-autocomplete
        v-model="searchQuery"
        :fetch-suggestions="fetchSuggestions"
        :debounce="300"
        placeholder="Tapez ≥ 2 lettres (nom ou téléphone)…"
        clearable
        style="width: 100%"
        @select="onSelect"
      >
        <template #default="{ item }">
          <div class="parent-suggestion">
            <span>{{ (item as IParentSuggestion).label }}</span>
            <el-tag v-if="(item as IParentSuggestion).usageCount" size="small" type="info" style="margin-left: 8px">
              {{ (item as IParentSuggestion).usageCount }} élève(s)
            </el-tag>
          </div>
        </template>
      </el-autocomplete>
      <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center">
        <el-tag v-if="linkedParentId != null" type="success" data-testid="parent-badge">
          Foyer lié #{{ linkedParentId }}<span v-if="linkedUsage != null"> ({{ linkedUsage }} élève(s))</span>
        </el-tag>
        <el-tag v-else type="info" data-testid="parent-badge-manual">Saisie manuelle</el-tag>
        <el-button v-if="linkedParentId != null" size="small" data-testid="parent-dissociate" @click="dissociate">
          Dissocier
        </el-button>
      </div>
    </el-form-item>

    <el-divider content-position="left">Père/Tuteur</el-divider>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom du père/tuteur">
          <el-input v-model="formData.fatherLastname" placeholder="Nom du père/tuteur" @input="onManualEdit" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Prénom du père/tuteur">
          <el-input v-model="formData.fatherFirstname" placeholder="Prénom du père/tuteur" @input="onManualEdit" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
    </el-row>

    <el-divider content-position="left">Mère/Tutrice</el-divider>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Nom de la mère/tutrice">
          <el-input v-model="formData.motherLastname" placeholder="Nom de la mère/tutrice" @input="onManualEdit" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Prénom de la mère/tutrice">
          <el-input v-model="formData.motherFirstname" placeholder="Prénom de la mère/tutrice" @input="onManualEdit" />
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col :span="8">
        <el-form-item label="Téléphone">
          <el-input v-model="formData.famillyPhone" placeholder="Numéro de Famille" @input="onManualEdit" />
        </el-form-item>
      </el-col>
      <el-col :span="16">
        <el-form-item label="Adresse du foyer">
          <el-input v-model="formData.address" placeholder="Adresse du foyer" @input="onManualEdit" />
        </el-form-item>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { unwrapParentSuggestions, type IParentSuggestion } from '@/types/student';

const props = defineProps<{
  formData: Record<string, unknown> & {
    fatherFirstname?: string;
    fatherLastname?: string;
    motherFirstname?: string;
    motherLastname?: string;
    famillyPhone?: string;
    address?: string;
    parentId?: number | null;
  };
}>();

const searchQuery = ref('');
const linkedParentId = ref<number | null>(
  typeof props.formData.parentId === 'number' ? (props.formData.parentId as number) : null,
);
const linkedUsage = ref<number | null>(null);

/** Resync externe (resetForSibling met parentId:null) → badge suit formData. */
watch(
  () => props.formData.parentId,
  (v) => {
    linkedParentId.value = typeof v === 'number' ? (v as number) : null;
    if (v == null) linkedUsage.value = null;
  },
);

/** Min 2 caractères : retourne [] sans appel IPC (évite QUERY_TOO_SHORT). */
async function fetchSuggestions(q: string, cb: (items: IParentSuggestion[]) => void): Promise<void> {
  const query = String(q ?? '').trim();
  if (query.length < 2) {
    cb([]);
    return;
  }
  try {
    const invoke = (window as unknown as { ipcRenderer?: { invoke: (c: string, p?: unknown) => Promise<unknown> } })
      .ipcRenderer?.invoke;
    if (!invoke) {
      cb([]);
      return;
    }
    let res: unknown = null;
    try {
      res = await invoke('parent:search', { q: query, limit: 10 });
    } catch {
      // Alias de repli (canal historique).
      res = await invoke('student:parents:search', { q: query, limit: 10 });
    }
    cb(unwrapParentSuggestions(res));
  } catch {
    cb([]);
  }
}

/** Sélection : remplit les 6 champs + parentId + badge. */
function onSelect(item: IParentSuggestion): void {
  const s = item as IParentSuggestion;
  props.formData.fatherFirstname = s.fatherFirstname ?? '';
  props.formData.fatherLastname = s.fatherLastname ?? '';
  props.formData.motherFirstname = s.motherFirstname ?? '';
  props.formData.motherLastname = s.motherLastname ?? '';
  props.formData.famillyPhone = s.famillyPhone ?? '';
  props.formData.address = s.address ?? props.formData.address ?? '';
  (props.formData as Record<string, unknown>).parentId = s.id;
  linkedParentId.value = s.id;
  linkedUsage.value = typeof s.usageCount === 'number' ? s.usageCount : null;
}

/** Toute édition manuelle après liaison → retour en saisie manuelle (déliaison). */
function onManualEdit(): void {
  if (linkedParentId.value != null) {
    linkedParentId.value = null;
    linkedUsage.value = null;
    (props.formData as Record<string, unknown>).parentId = null;
  }
}

/** Dissocier : vide parentId + les 6 champs + badge → manuelle. */
function dissociate(): void {
  (props.formData as Record<string, unknown>).parentId = null;
  props.formData.fatherFirstname = '';
  props.formData.fatherLastname = '';
  props.formData.motherFirstname = '';
  props.formData.motherLastname = '';
  props.formData.famillyPhone = '';
  props.formData.address = '';
  linkedParentId.value = null;
  linkedUsage.value = null;
  searchQuery.value = '';
}

defineExpose({ fetchSuggestions, onSelect, onManualEdit, dissociate, linkedParentId });
</script>

<style scoped>
.parent-suggestion {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
