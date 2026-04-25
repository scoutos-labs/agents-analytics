<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { TimeSeriesPoint } from '../types';

  Chart.register(...registerables);

  export let data: { points: TimeSeriesPoint[]; label?: string } = { points: [] };
  export let title = 'Chart';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function buildChart() {
    if (!canvas) return;
    if (chart) chart.destroy();

    const groups = new Map<string, { x: string; y: number }[]>();
    for (const p of data.points) {
      const key = p.group || '__default__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ x: p.bucket, y: p.value });
    }

    const colors = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa'];
    const datasets = Array.from(groups.entries()).map(([key, values], i) => ({
      label: key === '__default__' ? title : key,
      data: values,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '40',
      tension: 0.3,
      fill: true,
    }));

    chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e8e8ef' } },
        },
        scales: {
          x: {
            type: 'category',
            ticks: { color: '#a1a1aa', maxTicksLimit: 8 },
            grid: { color: '#27272a' },
          },
          y: {
            ticks: { color: '#a1a1aa' },
            grid: { color: '#27272a' },
          },
        },
      },
    });
  }

  $: if (data.points.length >= 0) buildChart();

  onMount(buildChart);
  onDestroy(() => chart?.destroy());
</script>

<div style="position: relative; height: 300px;">
  <canvas bind:this={canvas}></canvas>
</div>
