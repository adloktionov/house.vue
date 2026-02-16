<template>
  <div class="inputs-panel">
    <h3>Размеры дома</h3>
    <div class="field-group">
      <label>Длина (м)</label>
      <div class="input-row">
        <InputNumber v-model="localHouseLength" :min="1" :max="50" :minFractionDigits="1" :maxFractionDigits="2" :step="0.5" />
        <Slider v-model="localHouseLength" :min="1" :max="50" :step="0.5" class="slider" />
      </div>
    </div>
    <div class="field-group">
      <label>Ширина (м)</label>
      <div class="input-row">
        <InputNumber v-model="localHouseWidth" :min="1" :max="50" :minFractionDigits="1" :maxFractionDigits="2" :step="0.5" />
        <Slider v-model="localHouseWidth" :min="1" :max="50" :step="0.5" class="slider" />
      </div>
    </div>

    <h3>Размеры кирпича (мм)</h3>
    <div class="field-group">
      <label>Длина</label>
      <div class="input-row">
        <InputNumber v-model="localBrickLength" :min="100" :max="500" :step="10" />
        <Slider v-model="localBrickLength" :min="100" :max="500" :step="10" class="slider" />
      </div>
    </div>
    <div class="field-group">
      <label>Ширина (ряд)</label>
      <div class="input-row">
        <InputNumber v-model="localBrickWidth" :min="50" :max="250" :step="10" />
        <Slider v-model="localBrickWidth" :min="50" :max="250" :step="10" class="slider" />
      </div>
    </div>
    <div class="field-group">
      <label>Высота</label>
      <div class="input-row">
        <InputNumber v-model="localBrickHeight" :min="50" :max="150" :step="5" />
        <Slider v-model="localBrickHeight" :min="50" :max="150" :step="5" class="slider" />
      </div>
    </div>

    <h3>Кладка</h3>
    <div class="field-group">
      <label>Количество рядов</label>
      <div class="input-row">
        <InputNumber v-model="localRows" :min="1" :max="100" :step="1" />
        <Slider v-model="localRows" :min="1" :max="100" :step="1" class="slider" />
      </div>
      <p class="hint">Высота стен: {{ wallHeight?.toFixed(2) }} м</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'

const props = defineProps({
  houseLength: { type: Number, default: 10 },
  houseWidth: { type: Number, default: 10 },
  brickLength: { type: Number, default: 250 },
  brickWidth: { type: Number, default: 120 },
  brickHeight: { type: Number, default: 65 },
  rows: { type: Number, default: 10 },
  wallHeight: { type: Number, default: 0 },
})

const emit = defineEmits([
  'update:houseLength',
  'update:houseWidth',
  'update:brickLength',
  'update:brickWidth',
  'update:brickHeight',
  'update:rows',
])

const localHouseLength = computed({
  get: () => props.houseLength,
  set: (v) => emit('update:houseLength', v ?? 10),
})
const localHouseWidth = computed({
  get: () => props.houseWidth,
  set: (v) => emit('update:houseWidth', v ?? 10),
})
const localBrickLength = computed({
  get: () => props.brickLength,
  set: (v) => emit('update:brickLength', v ?? 250),
})
const localBrickWidth = computed({
  get: () => props.brickWidth,
  set: (v) => emit('update:brickWidth', v ?? 120),
})
const localBrickHeight = computed({
  get: () => props.brickHeight,
  set: (v) => emit('update:brickHeight', v ?? 65),
})
const localRows = computed({
  get: () => props.rows,
  set: (v) => emit('update:rows', v ?? 10),
})
</script>

<style scoped>
.inputs-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inputs-panel h3 {
  font-size: 1rem;
  margin: 0.5rem 0 0;
  color: #a0c4ff;
}

.inputs-panel h3:first-child {
  margin-top: 0;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ccc;
}

.input-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-row :deep(.p-inputnumber) {
  flex: 1;
}

.input-row :deep(.p-inputnumber-input) {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.input-row :deep(.p-slider) {
  width: 100%;
}

.input-row :deep(.p-slider .p-slider-handle) {
  background: #a0c4ff;
  border-color: #a0c4ff;
}

.input-row :deep(.p-slider .p-slider-range) {
  background: linear-gradient(90deg, #a0c4ff, #bdb2ff);
}

.hint {
  font-size: 0.8rem;
  color: #888;
  margin-top: 0.25rem;
}
</style>
