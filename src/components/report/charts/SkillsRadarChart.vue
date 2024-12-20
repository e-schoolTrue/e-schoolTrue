<template>
  <div class="skills-radar-chart">
    <Radar
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
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Radar } from 'vue-chartjs';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const props = defineProps<{
  skills: {
    name: string;
    value: number;
    maxValue: number;
  }[];
}>();

const chartData = computed(() => ({
  labels: props.skills.map(s => s.name),
  datasets: [
    {
      label: 'Niveau de compétence',
      data: props.skills.map(s => (s.value / s.maxValue) * 100),
      backgroundColor: 'rgba(42, 82, 152, 0.2)',
      borderColor: '#2a5298',
      pointBackgroundColor: '#2a5298',
    }
  ]
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      min: 0,
      max: 100,
      beginAtZero: true,
      ticks: {
        stepSize: 20
      }
    }
  },
  plugins: {
    legend: {
      display: false
    }
  }
};
</script>

<style scoped>
.skills-radar-chart {
  height: 300px;
  margin: 20px 0;
}
</style> 