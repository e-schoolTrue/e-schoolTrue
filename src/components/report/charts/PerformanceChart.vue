<template>
  <div class="performance-chart">
    <Line
      v-if="chartData"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const props = defineProps<{
  studentGrades: number[];
  classAverages: number[];
  labels: string[];
}>();

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [
    {
      label: 'Notes de l\'élève',
      backgroundColor: '#2a5298',
      borderColor: '#2a5298',
      data: props.studentGrades,
    },
    {
      label: 'Moyenne de la classe',
      backgroundColor: '#666',
      borderColor: '#666',
      data: props.classAverages,
    }
  ]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      min: 0,
      max: 20,
      ticks: {
        stepSize: 2
      }
    }
  },
  plugins: {
    legend: {
      position: 'bottom' as const
    }
  }
};
</script>

<style scoped>
.performance-chart {
  height: 300px;
  margin: 20px 0;
}
</style> 