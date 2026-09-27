<template>
  <div class="acc-curve">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useCurrency } from '@/composables/useCurrency'

Chart.register(...registerables)

const props = defineProps<{
  labels: string[]
  entrees: number[]
  sorties: number[]
}>()

const { formatMoney } = useCurrency()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function render(): void {
  if (!canvasRef.value) return
  if (chart) {
    chart.destroy()
    chart = null
  }
  const ctx = canvasRef.value.getContext('2d')
  const gradIn = ctx?.createLinearGradient(0, 0, 0, 280)
  gradIn?.addColorStop(0, 'rgba(103, 194, 58, 0.35)')
  gradIn?.addColorStop(1, 'rgba(103, 194, 58, 0)')
  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: props.labels,
      datasets: [
        {
          label: 'Entrées',
          data: props.entrees,
          borderColor: '#67C23A',
          backgroundColor: gradIn ?? 'rgba(103,194,58,0.15)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'Sorties',
          data: props.sorties,
          borderColor: '#F56C6C',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { usePointStyle: true, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label} : ${formatMoney(Number(c.raw ?? 0))}`,
          },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } },
      },
    },
  })
}

onMounted(render)
watch(() => [props.labels, props.entrees, props.sorties], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<style scoped>
.acc-curve {
  position: relative;
  height: 260px;
  width: 100%;
}
</style>
