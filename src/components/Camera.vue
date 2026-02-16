<template>
  <div class="camera-panel">
    <h3>Камера</h3>
    <div class="pos-panel">
      <span class="pos-label">Позиция:</span>
      <span class="pos-values">X: {{ fmt(camX) }}, Y: {{ fmt(camY) }}, Z: {{ fmt(camZ) }}</span>
    </div>
    <div class="btns-row">
      <button type="button" class="cam-btn" @click="$emit('view-x')">X</button>
      <button type="button" class="cam-btn" @click="$emit('view-y')">Y</button>
      <button type="button" class="cam-btn" @click="$emit('view-z')">Z</button>
    </div>
    <div class="btns-row">
      <button type="button" class="cam-btn cam-btn-def" @click="$emit('reset')">defCam</button>
      <button type="button" class="cam-btn cam-btn-4v" @click="$emit('four-view')">
        {{ fourView ? '1 вид' : '4view' }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  camX: { type: Number, default: 0 },
  camY: { type: Number, default: 0 },
  camZ: { type: Number, default: 0 },
  fourView: { type: Boolean, default: false },
})

defineEmits(['view-x', 'view-y', 'view-z', 'reset', 'four-view'])

function fmt(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(2)
}
</script>

<style scoped>
.camera-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.camera-panel h3 {
  font-size: 1rem;
  margin: 0;
  color: #a0c4ff;
}

.pos-panel {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pos-label {
  font-size: 0.8rem;
  color: #aaa;
}

.pos-values {
  font-size: 0.85rem;
  font-family: monospace;
  color: #bdb2ff;
}

.btns-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cam-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #e8e8e8;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.cam-btn:hover {
  background: rgba(160, 196, 255, 0.2);
  border-color: rgba(160, 196, 255, 0.5);
}

.cam-btn-def {
  background: rgba(101, 194, 149, 0.15);
  border-color: rgba(101, 194, 149, 0.4);
}

.cam-btn-def:hover {
  background: rgba(101, 194, 149, 0.3);
}

.cam-btn-4v {
  background: rgba(189, 178, 255, 0.15);
  border-color: rgba(189, 178, 255, 0.4);
}

.cam-btn-4v:hover {
  background: rgba(189, 178, 255, 0.3);
}
</style>
