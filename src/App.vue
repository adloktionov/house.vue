<template>
  <div class="app">
    <header class="header">
      <h1>Калькулятор кирпичей</h1>
      <p>Оценка количества кирпичей для стен дома</p>
    </header>

    <main class="main-grid">
      <aside class="panel panel-left">
        <InputsPanel
          v-model:house-length="houseLength"
          v-model:house-width="houseWidth"
          v-model:brick-length="brickLength"
          v-model:brick-width="brickWidth"
          v-model:brick-height="brickHeight"
          v-model:brick-gap="brickGap"
          v-model:edge-color="edgeColor"
          v-model:ground-color="groundColor"
          v-model:show-all-numbers="showAllNumbers"
          v-model:show-brick-dimensions="showBrickDimensions"
          v-model:label-size="labelSize"
        />
      </aside>

      <section class="canvas-area">
        <HouseCanvas
          :house-length="houseLength"
          :house-width="houseWidth"
          :brick-width="brickWidth"
          :brick-length="brickLength"
          :brick-height="brickHeight"
          :brick-gap="brickGap"
          :edge-color="edgeColor"
          :ground-color="groundColor"
          :show-all-numbers="showAllNumbers"
          :show-brick-dimensions="showBrickDimensions"
          :label-size="labelSize"
          :bricks-per-row="bricksPerRow"
          :rows="rows"
          :distribution-brick-count="distributionBrickCount"
        />
      </section>

      <aside class="panel panel-right">
        <div class="info-block info-block-clamping">
          <h3>Кладка</h3>
          <div class="field-group">
            <label>Количество рядов</label>
            <div class="input-row">
              <InputNumber v-model="rows" :min="1" :max="100" :step="1" />
              <Slider v-model="rows" :min="1" :max="100" :step="1" class="slider" />
            </div>
            <p class="hint">Высота стен: {{ wallHeight.toFixed(2) }} м</p>
          </div>
          <div class="field-group">
            <label>Количество кирпичей</label>
            <div class="input-row">
              <InputNumber
                v-model="distributionBrickCount"
                :min="0"
                :max="10000"
                :minFractionDigits="0"
                :maxFractionDigits="0"
                :step="1"
              />
              <Slider v-model="distributionBrickCount" :min="0" :max="500" :step="1" class="slider" />
            </div>
            <p class="hint">0 = полная кладка. При &gt;0: кирпичи по периметру; при замыкании круга — новый ряд со смещением на ½ кирпича</p>
          </div>
        </div>
        <div class="info-block">
          <h3>Размеры кирпича</h3>
          <p>Длина: {{ brickLength }} мм</p>
          <p>Ширина: {{ brickWidth }} мм</p>
          <p>Высота: {{ brickHeight }} мм</p>
          <p>Зазор: {{ brickGap }} мм</p>
        </div>
        <div class="info-block">
          <h3>Ряды / Высота</h3>
          <p>Рядов: {{ rows }}</p>
          <p>Высота стен: {{ wallHeight.toFixed(2) }} м</p>
        </div>
      </aside>
    </main>

    <footer class="footer">
      <ResultsTable
        :bricks-per-row="bricksPerRow"
        :rows="rows"
        :total-bricks="totalBricks"
        :wall-height="wallHeight"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import Slider from 'primevue/slider'
import InputsPanel from './components/InputsPanel.vue'
import HouseCanvas from './components/HouseCanvas.vue'
import ResultsTable from './components/ResultsTable.vue'

// Размеры дома (м)
const houseLength = ref(2)
const houseWidth = ref(2)

// Размеры кирпича (мм) — стандарт 250x120x65
const brickLength = ref(250)
const brickWidth = ref(120)
const brickHeight = ref(65)
const brickGap = ref(2)
const edgeColor = ref('#00ff00') // Цвет рёбер кирпичей (ярко-зелёный по умолчанию)
const groundColor = ref('#4a5568') // Цвет плоскости (фундамента) дома
const showAllNumbers = ref(false) // Показать номера кирпичей (выкл — скрыть, при hover всё равно показывать)
const showBrickDimensions = ref(false) // Показать размеры кирпича (стрелки X, Y, Z)
const labelSize = ref(1) // Размер лейбла (множитель 0.5–2)

// Количество рядов
const rows = ref(1)

// Поэтапное распределение: количество кирпичей (целое или дробное), по умолчанию 3
const distributionBrickCount = ref(3)

// Вычисляемые значения (с учётом зазоров)
const perimeter = computed(() => 2 * (houseLength.value + houseWidth.value))
const brickRowLengthM = computed(() => (brickWidth.value + brickGap.value) / 1000)
const bricksPerRow = computed(() => Math.ceil(perimeter.value / brickRowLengthM.value))
const totalBricks = computed(() => bricksPerRow.value * rows.value)
const wallHeight = computed(() => rows.value * (brickHeight.value + brickGap.value) / 1000)
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e8e8e8;
}

.header {
  text-align: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.2);
}

.header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.header p {
  opacity: 0.85;
  font-size: 0.95rem;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr minmax(400px, 2fr) 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
  flex: 1;
  align-items: start;
}

.panel {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-left {
  max-width: 320px;
}

.panel-right {
  max-width: 280px;
}

.info-block {
  margin-bottom: 1rem;
}

.info-block h3 {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
  color: #a0c4ff;
}

.info-block p {
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.info-block-clamping .field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-block-clamping .field-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ccc;
}

.info-block-clamping .input-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-block-clamping .input-row :deep(.p-inputnumber) {
  flex: 1;
}

.info-block-clamping .input-row :deep(.p-inputnumber-input) {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
}

.info-block-clamping .hint {
  font-size: 0.8rem;
  color: #a0a0a0;
  margin-top: 0.25rem;
}

.canvas-area {
  display: flex;
  justify-content: center;
  align-items: stretch;
  min-height: 480px;
  width: 100%;
}

.footer {
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
}

@media (max-width: 1024px) {
  .main-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }

  .panel-left,
  .panel-right {
    max-width: none;
  }

  .panel-right {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
}
</style>
