<template>
  <div class="acc-donut">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const props = defineProps<{
  labels: string[]
  values: number[]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null
const PALETTE = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#8B5CF6', '#14B8A6']

function render(): void {
  if (!canvasRef.value) return
  if (chart) {
    chart.destroy()
    chart = null
  }
  const labels = props.labels.length ? props.labels : ['Aucune donnée']
  const values = props.values.length ? props.values : [1]
  chart = new Chart(canvasRef.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, font: { size: 12 } } },
        tooltip: { enabled: props.values.length > 0 },
      },
    },
  })
}

onMounted(render)
watch(() => [props.labels, props.values], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<style scoped>
.acc-donut {
  position: relative;
  height: 220px;
  width: 100%;
}
</style>
