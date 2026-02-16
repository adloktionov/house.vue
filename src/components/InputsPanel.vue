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
    <div class="field-group">
      <label>Цвет плоскости дома</label>
      <div class="color-row">
        <input v-model="localGroundColor" type="color" class="color-input" />
        <span class="color-value">{{ localGroundColor }}</span>
      </div>
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
  groundColor: { type: String, default: '#4a5568' },
})

const emit = defineEmits(['update:houseLength', 'update:houseWidth', 'update:groundColor'])

const localHouseLength = computed({
  get: () => props.houseLength,
  set: (v) => emit('update:houseLength', v ?? 10),
})
const localHouseWidth = computed({
  get: () => props.houseWidth,
  set: (v) => emit('update:houseWidth', v ?? 10),
})
const localGroundColor = computed({
  get: () => props.groundColor,
  set: (v) => emit('update:groundColor', v ?? '#4a5568'),
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

.color-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.color-input {
  width: 48px;
  height: 32px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
}

.color-value {
  font-size: 0.85rem;
  color: #aaa;
}
</style>
