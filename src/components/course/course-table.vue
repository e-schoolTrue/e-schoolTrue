<script setup lang="ts">
import {ElTable, FormInstance} from 'element-plus'
import {Icon} from "@iconify/vue";
import {computed, ref} from "vue";
import {Course, CourseCommand} from "@/types/course";
import CourseDetails from "@/components/course/course-details.vue";
import CourseGroupForm from "@/components/course/course-group-form.vue";
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps<{
  courses: Course[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update', course: Course): void;
  (e: 'delete', course: Course): void;
  (e: 'add-to-group', course: Course): void;
}>();

const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

const filteredCourses = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return props.courses.filter(course => 
    (course.name?.toLowerCase() ?? '').includes(query) ||
    (course.code?.toLowerCase() ?? '').includes(query)
  );
});

const paginatedCourses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredCourses.value.slice(start, end);
});

const totalPages = computed(() => 
  Math.ceil(filteredCourses.value.length / pageSize.value)
);

const handleUpdate = (course: Course) => {
  emit('update', course);
};

const handleDelete = async (course: Course) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer le cours "${course.name}" ?`,
      'Attention',
      {
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning'
      }
    );
    emit('delete', course);
  } catch {
    // L'utilisateur a annulé la suppression
  }
};

const handleAddToGroup = (course: Course) => {
  emit('add-to-group', course);
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const newCourseGroupFormRef = ref<{ open: (parentCourse?: Course) => void; close: () => void; }>();
const courseDetailsRef = ref<{ open: (course: Course) => void; }>();
const currentParentCourseForSubModule = ref<Course | null>(null);

function openNewSubModuleForm(parentCourse: Course) {
  currentParentCourseForSubModule.value = parentCourse;
  newCourseGroupFormRef.value?.open();
}

function addNewSubModule(subModuleFormRef: FormInstance | undefined, subModuleFormData: CourseCommand) {
  if (!subModuleFormRef) return;
  if (!currentParentCourseForSubModule.value || typeof currentParentCourseForSubModule.value.id !== 'number') {
    ElMessage.error('Aucun cours parent sélectionné pour ajouter la sous-matière.');
    return;
  }

  subModuleFormRef.validate((valid, _fields) => {
      if (valid) {
      const newCourseData: Course = {
        name: subModuleFormData.name,
        code: subModuleFormData.code,
        coefficient: subModuleFormData.coefficient,
          isInGroupement: true,
        groupementId: currentParentCourseForSubModule.value!.id,
      };
      
      console.log('Données de sous-matière à ajouter:', newCourseData);
      emit('add-to-group', newCourseData);
      
      newCourseGroupFormRef.value?.close();
      currentParentCourseForSubModule.value = null;
    } else {
      ElMessage.error('Veuillez corriger les erreurs du formulaire de sous-matière.');
    }
  });
}
</script>

<template>
  <el-scrollbar height="530"  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <course-details
        ref="courseDetailsRef"
    />
    <course-group-form
        ref="newCourseGroupFormRef"
        form-title="Nouvelle sous-matière"
        @submit-action="addNewSubModule"
    />
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-input placeholder="Rechercher par nom ou code..." v-model="searchQuery">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="paginatedCourses"  style="max-width: 800px"  :border="false" empty-text="aucune matière trouvée" v-loading="loading">
        <el-table-column type="index" width="50" />
        <el-table-column label="Code"  prop="code" width="100"/>
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Coeff." prop="coefficient" width="80" />
        <el-table-column label="Groupe" width="80" align="center" >
          <template #default="scope">
            <el-tag v-if="scope.row?.isInGroupement" type="info" size="small">Sous-matière</el-tag>
            <el-tag v-else-if="scope.row?.courses && scope.row.courses.length > 0" type="success" size="small">Groupement</el-tag>
            <el-tag v-else type="plain" size="small">Simple</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="280">
          <template #default="scope">
            <el-space >
              <el-dropdown placement="bottom-start">
                <el-button size="small" type="info" >
                  <Icon icon="hugeicons:more-03"/>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>
                      <el-space>
                        <Icon icon="twemoji:woman-teacher"/>
                        <el-text>Gérer enseignants</el-text>
                      </el-space>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!scope.row?.isInGroupement" @click="openNewSubModuleForm(scope.row)">
                      <el-space>
                        <Icon icon="vscode-icons:folder-type-module"/>
                        <el-text>Ajouter une sous-matière</el-text>
                      </el-space>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip
                  effect="dark"
                  content="Détails de la matière"
                  placement="top"
              >
                <el-button size="small" type="warning" @click="courseDetailsRef?.open(scope.row)" >
                  <Icon icon="ph:eye-fill"/>
                </el-button>
              </el-tooltip>
              <el-tooltip
                  effect="dark"
                  content="Modifier"
                  placement="top"
              >
                <el-button size="small" type="primary" @click="handleUpdate(scope.row)" >
                  <Icon icon="mdi:pencil" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                  effect="dark"
                  content="Assigner à un groupement"
                  placement="top"
              >
                <el-button size="small" type="success" @click="handleAddToGroup(scope.row)" :disabled="scope.row?.isInGroupement" >
                  <Icon icon="mdi:folder-plus" />
                </el-button>
              </el-tooltip>
              <el-tooltip
                  effect="dark"
                  content="Supprimer"
                  placement="top"
              >
                <el-button size="small" type="danger" @click="handleDelete(scope.row)">
                  <Icon icon="mdi:delete" />
                </el-button>
              </el-tooltip>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
          :page-count="totalPages"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
          style=" display:flex ; justify-content: center; width: 100%; margin-top: 10px;" background layout="prev, pager, next" :total="filteredCourses.length"
      />
    </el-space>
  </el-scrollbar>
</template>

<style scoped>

</style>