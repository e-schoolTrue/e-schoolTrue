<script setup lang="ts">
import {ref} from "vue";

const schoolYear = ref()
const shcoolSection = ref()
const shcoolClasse= ref()
const search = ref('');
const options = [
  { value: '2021-2022', label: '2021-2022' },
  { value: '2022-2023', label: '2022-2023' },
  { value: '2023-2024', label: '2023-2024' },
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
  { value: '2027-2028', label: '2027-2028' },
  { value: '2028-2029', label: '2028-2029' },
  { value: '2029-2030', label: '2029-2030' },
  { value: '2030-2031', label: '2030-2031' },
  { value: '2031-2032', label: '2031-2032' },
  { value: '2032-2033', label: '2032-2033' },
  { value: '2033-2034', label: '2033-2034' },
  { value: '2034-2035', label: '2034-2035' },
  { value: '2035-2036', label: '2035-2036' },
  { value: '2036-2037', label: '2036-2037' },
  { value: '2037-2038', label: '2037-2038' },
  { value: '2038-2039', label: '2038-2039' },
  { value: '2039-2040', label: '2039-2040' },
  { value: '2040-2041', label: '2040-2041' },
  { value: '2041-2042', label: '2041-2042' },
  { value: '2042-2043', label: '2042-2043' },
  { value: '2043-2044', label: '2043-2044' }]
const studentClassesSectionOptions = [
  { value: '1', label: 'A' },
  { value: '2', label: 'B' },
  { value: '3', label: 'C' },
  { value: '4', label: 'D' },
  { value: '5', label: 'E' }
]
const studentClassesOptions = [
  { value: '1', label: '1ère' },
  { value: '2', label: '2ème' },
  { value: '3', label: '3ème' },
  { value: '4', label: '4ème' },
  { value: '5', label: '5ème' },
  { value: '6', label: '6ème' },
  { value: '7', label: '7ème' },
  { value: '8', label: '8ème' },
  { value: '9', label: '9ème' },
  { value: '10', label: '10ème' },
  { value: '11', label: '11ème' },
  { value: '12', label: '12ème' },
  { value: '12', label: 'Terminal' },
]
</script>

<template>
    <el-card>
      <el-form>
        <el-space direction="vertical" fill="fill">
          <el-text size="large" style="font-weight: bold">Filtres</el-text>
          <el-space direction="horizontal">
            <el-form-item label="Année scolaire">
              <el-select style="width: 150px" v-model="schoolYear" placeholder="Année scolaire">
                <el-option
                    v-for="item in options"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value">
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Classe de l'élève">
              <el-select style="width: 150px" v-model="shcoolClasse" placeholder="Classe de l'élève">
                <el-option
                    v-for="item in studentClassesOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value">
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Section de l'élève">
              <el-select style="width: 150px" v-model="shcoolSection" placeholder="Section de l'élève">
                <el-option
                    v-for="item in studentClassesSectionOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value">
                </el-option>
              </el-select>
            </el-form-item>
          </el-space>
          <el-space direction="horizontal">
            <el-form-item label="PV de élève">
              <el-input v-model="search" placeholder="PV de élève" prefix-icon="el-icon-search"></el-input>
            </el-form-item>
            <el-form-item label="Nom de l'élève">
              <el-input v-model="search" placeholder="Nom de l'élève" prefix-icon="el-icon-search"></el-input>
            </el-form-item>
            <el-form-item label="Prénom de l'élève">
              <el-input v-model="search" placeholder="Prénom de l'élève" prefix-icon="el-icon-search"></el-input>
            </el-form-item>
          </el-space>
          <el-button style="width:50px" type="primary">Filtrez</el-button>
        </el-space>
      </el-form>
    </el-card>
</template>

<style scoped>
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>