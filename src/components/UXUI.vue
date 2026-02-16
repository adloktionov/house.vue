<template>
  <Teleport to="body">
    <div
      v-if="hoveredBrickData"
      class="uxui-brick-panel"
      :style="panelStyle"
    >
      <table class="uxui-table">
        <tbody>
          <tr>
            <th>№</th>
            <td>{{ hoveredBrickData?.number ?? '—' }}</td>
          </tr>
          <tr>
            <th>Размеры</th>
            <td>{{ hoveredBrickData?.dimensions ?? '—' }}</td>
          </tr>
          <tr>
            <th>Тип</th>
            <td>{{ hoveredBrickData?.isClosure ? 'Замыкающий' : 'Обычный' }}</td>
          </tr>
          <tr>
            <th>До N−1</th>
            <td>{{ formatDistance(hoveredBrickData?.distToPrev) }}</td>
          </tr>
          <tr>
            <th>До N+1</th>
            <td>{{ formatDistance(hoveredBrickData?.distToNext) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  hoveredBrickData: { type: Object, default: null },
  pointerX: { type: Number, default: 0 },
  pointerY: { type: Number, default: 0 },
})

const panelStyle = computed(() => {
  const padding = 16
  const panelWidth = 200
  const panelHeight = 180
  let left = props.pointerX + 20
  let top = props.pointerY + 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (left + panelWidth > vw - padding) left = props.pointerX - panelWidth - 20
  if (top + panelHeight > vh - padding) top = vh - panelHeight - padding
  if (left < padding) left = padding
  if (top < padding) top = padding
  return {
    left: `${left}px`,
    top: `${top}px`,
  }
})

function formatDistance(d) {
  if (d == null) return '—'
  if (d.overlapMm != null) return `пересечение ${d.overlapMm} мм`
  return `${d.gapMm} мм`
}
</script>

<style scoped>
.uxui-brick-panel {
  position: fixed;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.1);
  color: #00ff00;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 0.85rem;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  pointer-events: none;
}

.uxui-table {
  width: 100%;
  border-collapse: collapse;
}

.uxui-table th {
  text-align: left;
  font-weight: 600;
  padding: 4px 12px 4px 0;
  color: #00ff00;
}

.uxui-table td {
  padding: 4px 0;
  color: #00ff00;
}

.uxui-table tr:not(:last-child) th,
.uxui-table tr:not(:last-child) td {
  border-bottom: 1px solid rgba(0, 255, 0, 0.3);
}
</style>
