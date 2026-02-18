<template>
  <div class="brick-panel">
    <h3>Кирпич</h3>
    <div class="field-group">
      <label>Количество кирпичей</label>
      <div class="input-row">
        <InputNumber
          v-model="localDistributionBrickCount"
          :min="0"
          :max="10000"
          :minFractionDigits="0"
          :maxFractionDigits="0"
          :step="1"
        />
        <Slider v-model="localDistributionBrickCount" :min="0" :max="500" :step="1" class="slider" />
      </div>
    </div>
    <div class="section">
      <h4>Размеры кирпича (мм)</h4>
      <div class="field-group">
        <label>Тип кирпича</label>
        <Dropdown
          v-model="selectedPreset"
          :options="brickPresets"
          option-label="label"
          option-value="value"
          placeholder="Выберите тип"
          class="brick-preset-select"
          @change="onPresetChange($event.value)"
        />
      </div>
      <div class="field-group">
        <label>Длина</label>
        <div class="input-row">
          <InputNumber v-model="localBrickLength" :min="1" :max="1000" :step="5" />
          <Slider v-model="localBrickLength" :min="1" :max="1000" :step="5" class="slider" />
        </div>
      </div>
      <div class="field-group">
        <label>Ширина (ряд)</label>
        <div class="input-row">
          <InputNumber v-model="localBrickWidth" :min="1" :max="1000" :step="5" />
          <Slider v-model="localBrickWidth" :min="1" :max="1000" :step="5" class="slider" />
        </div>
      </div>
      <div class="field-group">
        <label>Высота</label>
        <div class="input-row">
          <InputNumber v-model="localBrickHeight" :min="1" :max="1000" :step="5" />
          <Slider v-model="localBrickHeight" :min="1" :max="1000" :step="5" class="slider" />
        </div>
      </div>
      <div class="field-group">
        <label>Зазор между кирпичами (мм)</label>
        <div class="input-row">
          <InputNumber v-model="localBrickGap" :min="1" :max="3" :step="0.5" :minFractionDigits="0" :maxFractionDigits="1" />
          <Slider v-model="localBrickGap" :min="1" :max="3" :step="0.5" class="slider" />
        </div>
      </div>
    </div>

    <div class="section">
      <h4>Оформление</h4>
      <div class="field-group">
        <label>Цвет рёбер кирпичей</label>
        <div class="color-row">
          <input v-model="localEdgeColor" type="color" class="color-input" />
          <span class="color-value">{{ localEdgeColor }}</span>
        </div>
      </div>
      <div class="field-group">
        <label>Цвет зазора</label>
        <div class="color-row">
          <input v-model="localGapColor" type="color" class="color-input" />
          <span class="color-value">{{ localGapColor }}</span>
        </div>
      </div>
      <div class="field-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            class="checkbox-input"
            :checked="showAllNumbers"
            @change="emit('update:showAllNumbers', ($event.target).checked)"
          />
          Показать все номера кирпичей
        </label>
      </div>
      <div class="field-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            class="checkbox-input"
            :checked="showBrickSides"
            @change="emit('update:showBrickSides', ($event.target).checked)"
          />
          Показать стороны кирпичей (N/S/E/W)
        </label>
      </div>
      <div class="field-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            class="checkbox-input"
            :checked="showBrickDimensions"
            @change="emit('update:showBrickDimensions', ($event.target).checked)"
          />
          Показать размеры кирпича
        </label>
      </div>
      <div class="field-group">
        <label class="checkbox-label">
          <input
            type="checkbox"
            class="checkbox-input"
            :checked="showBrickDistances"
            @change="emit('update:showBrickDistances', ($event.target).checked)"
          />
          Показать расстояния между кирпичами
        </label>
      </div>
      <div v-if="showBrickDistances && brickDistances?.length" class="field-group distances-list">
        <h4>Расстояния (мм)</h4>
        <ul class="distances-ul">
          <li v-for="d in brickDistances" :key="`${d.from}-${d.to}`" :class="{ overlap: d.overlapMm }">
            {{ d.from }} → {{ d.to }}: <strong>{{ d.overlapMm != null ? `пересечение ${d.overlapMm}` : d.gapMm }}</strong>
          </li>
        </ul>
      </div>
      <div class="field-group">
        <label>Размер лейбла кирпича</label>
        <div class="input-row">
          <Slider v-model="localLabelSize" :min="0.5" :max="2" :step="0.1" class="slider" />
          <span class="hint">{{ localLabelSize.toFixed(1) }}×</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h4>Кладка</h4>
      <div class="field-group">
        <label>Количество рядов</label>
        <div class="input-row">
          <InputNumber v-model="localRows" :min="1" :max="100" :step="1" />
          <Slider v-model="localRows" :min="1" :max="100" :step="1" class="slider" />
        </div>
        <p class="hint">Высота стен: {{ wallHeight.toFixed(2) }} м</p>
      </div>
      <div class="field-group">
        <p class="hint">0 = полная кладка. При &gt;0: кирпичи по периметру</p>
      </div>
    </div>

    <div class="section section-summary">
      <h4>Размеры кирпича</h4>
      <p>Длина: {{ brickLength }} мм</p>
      <p>Ширина: {{ brickWidth }} мм</p>
      <p>Высота: {{ brickHeight }} мм</p>
      <p>Зазор: {{ brickGap }} мм</p>
      <p><strong>Рядов:</strong> {{ rows }}, <strong>Высота стен:</strong> {{ wallHeight.toFixed(2) }} м</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import Dropdown from 'primevue/dropdown'

const brickPresets = [
  { label: 'Стандартный (250×120×65)', value: 'standard', length: 250, width: 120, height: 65 },
  { label: 'СТО НААГ (625×500×250)', value: 'stonaag', length: 625, width: 500, height: 250 },
  { label: 'Свой размер', value: 'custom' },
]

const props = defineProps({
  brickLength: { type: Number, default: 250 },
  brickWidth: { type: Number, default: 120 },
  brickHeight: { type: Number, default: 65 },
  brickGap: { type: Number, default: 2 },
  edgeColor: { type: String, default: '#00ff00' },
  gapColor: { type: String, default: '#888888' },
  showAllNumbers: { type: Boolean, default: false },
  showBrickSides: { type: Boolean, default: false },
  showBrickDimensions: { type: Boolean, default: false },
  showBrickDistances: { type: Boolean, default: false },
  brickDistances: { type: Array, default: () => [] },
  labelSize: { type: Number, default: 1 },
  rows: { type: Number, default: 1 },
  distributionBrickCount: { type: Number, default: 3 },
})

const emit = defineEmits([
  'update:brickLength',
  'update:brickWidth',
  'update:brickHeight',
  'update:brickGap',
  'update:edgeColor',
  'update:gapColor',
  'update:showAllNumbers',
  'update:showBrickSides',
  'update:showBrickDimensions',
  'update:showBrickDistances',
  'update:labelSize',
  'update:rows',
  'update:distributionBrickCount',
])

const selectedPreset = ref('standard')
const userChoseCustom = ref(false)

watch(
  () => [props.brickLength, props.brickWidth, props.brickHeight],
  () => {
    const preset = brickPresets.find(
      (p) =>
        p.length !== undefined &&
        p.length === props.brickLength &&
        p.width === props.brickWidth &&
        p.height === props.brickHeight
    )
    if (preset) {
      userChoseCustom.value = false
      selectedPreset.value = preset.value
    } else if (!userChoseCustom.value) {
      selectedPreset.value = 'custom'
    }
  },
  { immediate: true }
)

function onPresetChange(value) {
  if (value === 'custom') {
    userChoseCustom.value = true
    selectedPreset.value = 'custom'
    return
  }
  userChoseCustom.value = false
  const preset = brickPresets.find((p) => p.value === value)
  if (preset?.length !== undefined) {
    emit('update:brickLength', preset.length)
    emit('update:brickWidth', preset.width)
    emit('update:brickHeight', preset.height)
  }
}

const wallHeight = computed(() => props.rows * (props.brickHeight + props.brickGap) / 1000)

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
const localBrickGap = computed({
  get: () => props.brickGap,
  set: (v) => emit('update:brickGap', v ?? 2),
})
const localEdgeColor = computed({
  get: () => props.edgeColor,
  set: (v) => emit('update:edgeColor', v ?? '#00ff00'),
})
const localGapColor = computed({
  get: () => props.gapColor,
  set: (v) => emit('update:gapColor', v ?? '#888888'),
})
const localLabelSize = computed({
  get: () => props.labelSize,
  set: (v) => emit('update:labelSize', v ?? 1),
})
const localRows = computed({
  get: () => props.rows,
  set: (v) => emit('update:rows', v ?? 1),
})
const localDistributionBrickCount = computed({
  get: () => props.distributionBrickCount,
  set: (v) => emit('update:distributionBrickCount', v ?? 3),
})
</script>

<style scoped>
.brick-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.brick-panel h3 {
  font-size: 1rem;
  margin: 0 0 0.5rem;
  color: #a0c4ff;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section h4 {
  font-size: 0.9rem;
  margin: 0;
  color: #bdb2ff;
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

.brick-preset-select :deep(.p-dropdown) {
  width: 100%;
}

.brick-preset-select :deep(.p-dropdown-label),
.brick-preset-select :deep(.p-dropdown-trigger) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.section-summary p {
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.distances-list ul.distances-ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.85rem;
  color: #ccc;
}

.distances-list li.overlap strong {
  color: #ff6b6b;
}
</style>
