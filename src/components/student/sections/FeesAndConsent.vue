<template>
  <div>
    <h3>Frais et Consentements</h3>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Frais d'inscription">
          <el-input-number v-model="formData.inscriptionFees" :min="0" :precision="2"></el-input-number>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Frais de scolarité annuels">
          <el-input-number v-model="formData.annualFees" :min="0" :precision="2"></el-input-number>
        </el-form-item>
      </el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="Frais de bus">
          <el-input-number v-model="formData.busFees" :min="0" :precision="2"></el-input-number>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="Frais de cantine">
          <el-input-number v-model="formData.canteenFees" :min="0" :precision="2"></el-input-number>
        </el-form-item>
      </el-col>
    </el-row>
    <el-form-item label="Modalité de paiement">
      <el-radio-group v-model="formData.paymentMode">
        <el-radio label="once">Paiement en une fois</el-radio>
        <el-radio label="twice">Paiement en deux fois</el-radio>
        <el-radio label="thrice">Paiement en trois fois</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="Consentements">
      <el-checkbox v-model="formData.emergencyConsent">J'autorise l'école à administrer les premiers soins en cas d'urgence</el-checkbox>
      <el-checkbox v-model="formData.rulesConsent">J'accepte les règlements de l'école</el-checkbox>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
defineProps(['formData']);
</script>
