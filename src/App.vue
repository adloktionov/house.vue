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
          v-model:ground-color="groundColor"
        />
        <Camera
          :cam-x="cameraPos.x"
          :cam-y="cameraPos.y"
          :cam-z="cameraPos.z"
          :four-view="fourViewMode"
          @view-x="onCameraViewX"
          @view-y="onCameraViewY"
          @view-z="onCameraViewZ"
          @reset="onCameraReset"
          @four-view="onFourView"
        />
      </aside>

      <section class="canvas-area">
        <HouseCanvas
          ref="houseCanvasRef"
          :house-length="houseLength"
          :house-width="houseWidth"
          :brick-width="brickWidth"
          :brick-length="brickLength"
          :brick-height="brickHeight"
          :brick-gap="brickGap"
          :edge-color="edgeColor"
          :gap-color="gapColor"
          :ground-color="groundColor"
          :show-all-numbers="showAllNumbers"
          :show-brick-sides="showBrickSides"
          :show-brick-dimensions="showBrickDimensions"
          :show-brick-distances="showBrickDistances"
          :label-size="labelSize"
          :distribution-brick-count="distributionBrickCount"
          @brick-distances="brickDistances = $event"
          @brick-hover="onBrickHover"
          @camera-position="onCameraPosition"
        />
      </section>

      <aside class="panel panel-right">
        <BrickPanel
          v-model:brick-length="brickLength"
          v-model:brick-width="brickWidth"
          v-model:brick-height="brickHeight"
          v-model:brick-gap="brickGap"
          v-model:edge-color="edgeColor"
          v-model:gap-color="gapColor"
          v-model:show-all-numbers="showAllNumbers"
          v-model:show-brick-sides="showBrickSides"
          v-model:show-brick-dimensions="showBrickDimensions"
          v-model:show-brick-distances="showBrickDistances"
          v-model:label-size="labelSize"
          v-model:rows="rows"
          v-model:distribution-brick-count="distributionBrickCount"
          :brick-distances="brickDistances"
        />
      </aside>
    </main>

    <section class="path-section">
      <h2 class="path-section__title">Путь и кирпичи</h2>
      <PathBrickDrawer
        :brick-length="brickLength"
        :brick-width="brickWidth"
        :brick-height="brickHeight"
        :brick-gap="brickGap"
        :gap-color="gapColor"
      />
    </section>

    <UXUI
      :hovered-brick-data="hoveredBrickData"
      :pointer-x="pointerX"
      :pointer-y="pointerY"
    />

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
import InputsPanel from './components/InputsPanel.vue'
import BrickPanel from './components/BrickPanel.vue'
import HouseCanvas from './components/HouseCanvas.vue'
import ResultsTable from './components/ResultsTable.vue'
import UXUI from './components/UXUI.vue'
import Camera from './components/Camera.vue'
import PathBrickDrawer from './components/PathBrickDrawer.vue'

const houseLength = ref(2)
const houseWidth = ref(2)
const groundColor = ref('#4a5568')

const brickLength = ref(250)
const brickWidth = ref(120)
const brickHeight = ref(65)
const brickGap = ref(2)
const edgeColor = ref('#00ff00')
const gapColor = ref('#888888')
const showAllNumbers = ref(false)
const showBrickSides = ref(false)
const showBrickDimensions = ref(false)
const showBrickDistances = ref(false)
const brickDistances = ref([])
const labelSize = ref(1)

const rows = ref(1)
const distributionBrickCount = ref(3)

const hoveredBrickData = ref(null)
const pointerX = ref(0)
const pointerY = ref(0)

const houseCanvasRef = ref(null)
const cameraPos = ref({ x: 20, y: 12, z: 20 })
const fourViewMode = ref(false)

function onCameraPosition({ x, y, z }) {
  cameraPos.value = { x, y, z }
}

function onCameraViewX() {
  houseCanvasRef.value?.setCameraViewX?.()
}

function onCameraViewY() {
  houseCanvasRef.value?.setCameraViewY?.()
}

function onCameraViewZ() {
  houseCanvasRef.value?.setCameraViewZ?.()
}

function onCameraReset() {
  houseCanvasRef.value?.resetCamera?.()
}

function onFourView() {
  fourViewMode.value = !fourViewMode.value
  houseCanvasRef.value?.setFourViewMode?.(fourViewMode.value)
}

function onBrickHover(payload) {
  if (!payload) return
  hoveredBrickData.value = payload.data ?? null
  pointerX.value = payload.pointerX ?? 0
  pointerY.value = payload.pointerY ?? 0
}

const perimeter = computed(() => 2 * (houseLength.value + houseWidth.value))
const brickRowLengthM = computed(() => (brickLength.value + brickGap.value) / 1000)
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
  max-width: 320px;
}

.canvas-area {
  display: flex;
  justify-content: center;
  align-items: stretch;
  min-height: 480px;
  width: 100%;
}

.path-section {
  padding: 0 1.5rem 1.5rem;
}

.path-section__title {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
  opacity: 0.9;
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
    display: block;
  }
}
</style>
