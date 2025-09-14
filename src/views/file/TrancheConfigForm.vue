<script setup lang="ts">
import {reactive, ref} from "vue";
import {FormInstance, FormRules} from 'element-plus'
import {Icon} from "@iconify/vue";
import { IPaymentAnnualConfig, ITranchConfig, ITrancheEntry } from "@/types/payment";
// @ts-ignore
import { PaymentAnnualConfigEntity } from "#electron/backend/entities/paymentConfig";


const props = defineProps<{ title: string }>()
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<IPaymentAnnualConfig>({
  id:0,
  trancheCount:0,
  gradeId:0,
  tranches:[]
})

const formRule = reactive<FormRules<IPaymentAnnualConfig>>({
  trancheCount: [
    {required: true, message: 'ce champ est requis', trigger: 'blur'},
  ],
  gradeId: [
    {required: true, message: 'ce champ est requis', trigger: 'blur'},
  ],
})

function open(paymentAnnualConfig?: PaymentAnnualConfigEntity) {
  dialogVisible.value = true
  if (paymentAnnualConfig) {
    form.id = paymentAnnualConfig.id!
    form.trancheCount = paymentAnnualConfig.trancheCount!
    form.gradeId = paymentAnnualConfig.grade?.id!
    paymentAnnualConfig.tranches?.forEach((tranche: ITranchConfig) => {
      form.tranches?.push({
        id: tranche.id!,
        tranchName: tranche.tranchName!,
        tranchMonthCount: tranche.tranchMonthCount!, 
        entries: tranche.entries?.map((entry: ITrancheEntry) => {
          return {
            id: entry.id!,
            startDate: entry.startDate!,
            endDate: entry.endDate!
          }
        })
      })
    })
  }
}

function close() {
  dialogVisible.value = false
}

function onSubmit(formData:PaymentAnnualConfigEntity){
  const paymentAnnualConfig:PaymentAnnualConfigEntity = {
    id: formData.id,
    trancheCount: formData.trancheCount,
    grade: formData.grade,
    tranches: formData.tranches
  }
  emits("submitAction", formRef.value , paymentAnnualConfig )
}

const emits = defineEmits<{
  (e: "submitAction", formRef: FormInstance | undefined, form: PaymentAnnualConfigEntity): any
}>()

defineExpose({
  open,
  close
})

</script>

<template>
  <el-dialog
      v-model="dialogVisible"
      title="Tips"
      width="500"
  >
    <template #header>
      <el-space>
        <Icon icon="ei:plus" color="#D62F29"/>
        <el-text type="warning">{{ props.title }}</el-text>
      </el-space>
    </template>
    <el-form
        ref="formRef"
        style="max-width: 500px"
        :model="form"
        :rules="formRule"
        label-width="auto"
        status-icon
    >
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="warning" @click="onSubmit(form as PaymentAnnualConfigEntity)">
          Valider
        </el-button>
      </div>
    </template>
    </el-form>
  </el-dialog>
</template>

<style scoped>
.el-form {
  background-color: #ffffff;
  padding-left: 10px;
}

.el-text {
  font-family: "Arial Black";
}
</style>