<script setup lang="ts">
import {ElTable, FormInstance} from 'element-plus'
import {Icon} from "@iconify/vue";
import {computed, reactive, ref} from "vue";
import {ClassRoomCommand, CourseCommand} from "#electron/command/settingsCommand.ts";
import {CourseEntity} from "#electron/backend/entities/course.ts";
import CourseDetails from "@/components/course/course-details.vue";
import CourseGroupForm from "@/components/course/course-group-form.vue";
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps<{
  courses: CourseEntity[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update', course: CourseEntity): void;
  (e: 'delete', course: CourseEntity): void;
  (e: 'add-to-group', course: CourseEntity): void;
}>();

const searchQuery = ref('');
const currentPage = ref(1);
const pageSize = ref(10);

const filteredCourses = computed(() => {
  const query = searchQuery.value.toLowerCase();
  return props.courses.filter(course => 
    course.name.toLowerCase().includes(query) ||
    course.code.toLowerCase().includes(query)
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

const handleUpdate = (course: CourseEntity) => {
  emit('update', course);
};

const handleDelete = async (course: CourseEntity) => {
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

const handleAddToGroup = (course: CourseEntity) => {
  emit('add-to-group', course);
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const searchForm = ref("")
const newCourseGroupFormRef = ref()
const paginator = reactive<{
  totalPage:number
  pageSize:number
  currentPage:number
}>({
  totalPage:0,
  pageSize:5 ,
  currentPage:1
})
const courseDetailsRef = ref()

function addCourseGroup(formRef: FormInstance|undefined, form: ClassRoomCommand){
  // This function is no longer used in the new version
}

function handleCurrentPage(pageNumber:number){
  // This function is no longer used in the new version
}
</script>

<template>
  <el-scrollbar height="530"  style="padding: 10px ; display:flex; flex-direction: row ; justify-content: center; align-items: center ; width: 100%">
    <course-details
        ref="courseDetailsRef"
    />
    <course-group-form
        ref="newCourseGroupFormRef"
        form-title="Nouvelle sous matière"
        @submit-action="addCourseGroup"
    />
    <el-space direction="vertical" fill="fill" style=" width: 800px">
      <el-input placeholder="tapez quelques chose!" v-model="searchQuery">
        <template #prepend>
          <Icon width="20" icon="akar-icons:search"/>
        </template>
      </el-input>
      <el-table :data="paginatedCourses"  style="max-width: 800px"  :border="false" empty-text="aucune matière trouvée" v-loading="loading">
        <el-table-column type="index" />
        <el-table-column label="Code"  prop="code"/>
        <el-table-column label="Nom" prop="name" />
        <el-table-column label="Coefficient" prop="coefficient" />
        <el-table-column label="Groupe de matière" >
          <template #default="scope">
            <el-checkbox :checked="scope.row?.courses.length>0" :disabled="true" size="large" />
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="280">
          <template #default="scope">
            <el-space >
              <el-dropdown placement="top-start">
                <el-button size="small" type="danger" >
                  <Icon icon="hugeicons:more-03"/>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>
                      <el-space>
                        <Icon icon="twemoji:woman-teacher"/>
                        <el-text>Ajout d'un enseignants de la matière</el-text>
                      </el-space>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="!scope.row?.isInGroupement" @click="newCourseGroupFormRef.open(scope.row)">
                      <el-space>
                        <Icon icon="vscode-icons:folder-type-module"/>
                        <el-text>Ajout d'une sous matière</el-text>
                      </el-space>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-tooltip
                  class="box-item"
                  effect="dark"
                  content="Détails de la matière"
                  placement="top-start"
              >
                <el-button size="small" type="warning" @click="courseDetailsRef.open(scope.row)" >
                  <Icon icon="ph:eye-fill"/>
                </el-button>
              </el-tooltip>
              <el-button size="small" type="primary" @click="handleUpdate(scope.row)" >Modifier</el-button>
              <el-button size="small" type="success" @click="handleAddToGroup(scope.row)" :disabled="scope.row?.isInGroupement" >Ajouter au groupement</el-button>
              <el-button size="small" type="danger" @click="handleDelete(scope.row)">Supprimer</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
          :page-count="totalPages"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
          style=" display:flex ; justify-content: center; width: 600px" background layout="prev, pager, next" :total="filteredCourses.length"
      />
    </el-space>
  </el-scrollbar>
</template>

<style scoped>

</style>