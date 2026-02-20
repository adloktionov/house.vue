<template>
  <div class="path-drawer">
    <div class="path-drawer__toolbar">
      <span class="path-drawer__hint">
        <template v-if="drawingMode">
          Режим рисования: клик — добавить точку. <strong>Enter</strong> — зафиксировать путь.
        </template>
        <template v-else>
          <strong>Alt+1+2</strong> — включить режим рисования пути.
        </template>
      </span>
      <label v-if="pathFixed" class="path-drawer__count">
        Количество кирпичей:
        <input
          v-model.number="brickCount"
          type="number"
          min="1"
          max="500"
          class="path-drawer__input"
        />
      </label>
    </div>
    <div ref="containerRef" class="path-drawer__canvas" />
  </div>
</template>

<script setup>
/**
 * PathBrickDrawer — рисование ломаной на плоскости и расстановка кирпичей вдоль неё.
 * Alt+1+2 — войти в режим рисования; клики — точки; Enter — зафиксировать; затем меняем кол-во кирпичей.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { usePathDrawing } from '../composables/usePathDrawing.js'

const props = defineProps({
  brickLength: { type: Number, default: 625 },
  brickWidth: { type: Number, default: 500 },
  brickHeight: { type: Number, default: 250 },
  brickGap: { type: Number, default: 2 },
  gapColor: { type: String, default: '#888888' },
})

const containerRef = ref(null)
const drawingMode = ref(false)
const pathFixed = ref(false)
const brickCount = ref(10)

const pathApi = usePathDrawing(containerRef)

// Одновременно нажаты Alt, 1 и 2
const keysDown = new Set()

function onKeyDown(e) {
  if (e.key === '1' || e.key === '2') keysDown.add(e.key)
  if (e.altKey && keysDown.has('1') && keysDown.has('2')) {
    drawingMode.value = true
    pathFixed.value = false
    pathApi.clearPoints()
  }
  if (e.key === 'Enter' && drawingMode.value) {
    e.preventDefault()
    drawingMode.value = false
    if (pathApi.getPoints().length >= 2) pathFixed.value = true
    updateBricks()
  }
}

function onKeyUp(e) {
  keysDown.delete(e.key)
}

function onClick(e) {
  if (!drawingMode.value || !containerRef.value) return
  const pos = pathApi.intersectPlane(e.clientX, e.clientY)
  if (pos) pathApi.addPoint(pos)
}

function updateBricks() {
  if (!pathFixed.value || pathApi.getPoints().length < 2) return
  const lenM = props.brickLength / 1000
  const widthM = props.brickWidth / 1000
  const heightM = props.brickHeight / 1000
  const gapM = props.brickGap / 1000
  const gapColorHex = typeof props.gapColor === 'string' ? parseInt(props.gapColor.replace('#', ''), 16) : 0x888888
  pathApi.placeBricksAlongPath(brickCount.value, lenM, widthM, heightM, gapM, gapColorHex)
}

onMounted(() => {
  pathApi.init()
  pathApi.animate()
  window.addEventListener('resize', pathApi.onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  const el = containerRef.value
  if (el) el.addEventListener('click', onClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', pathApi.onResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  const el = containerRef.value
  if (el) el.removeEventListener('click', onClick)
  pathApi.dispose()
})

watch(
  () => [brickCount.value, pathFixed.value],
  () => updateBricks(),
  { immediate: true }
)
watch(
  () => [props.brickLength, props.brickWidth, props.brickHeight, props.brickGap, props.gapColor],
  () => updateBricks()
)
</script>

<style scoped>
.path-drawer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.path-drawer__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

.path-drawer__hint {
  color: #e2e8f0;
  font-size: 0.9rem;
}

.path-drawer__hint strong {
  color: #fbbf24;
}

.path-drawer__count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e2e8f0;
  font-size: 0.9rem;
}

.path-drawer__input {
  width: 72px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 0.9rem;
}

.path-drawer__canvas {
  position: relative;
  width: 100%;
  min-height: 400px;
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
