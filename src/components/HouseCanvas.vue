<template>
  <!-- Контейнер для WebGL-канваса Three.js -->
  <div ref="containerRef" class="canvas-wrapper" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

// ========== ПРОПСЫ ==========
// Размеры дома (м), кирпича (мм), зазор (мм), кол-во кирпичей в ряду и рядов
const props = defineProps({
  houseLength: { type: Number, default: 10 },
  houseWidth: { type: Number, default: 10 },
  brickWidth: { type: Number, default: 500 },
  brickLength: { type: Number, default: 625 },
  brickHeight: { type: Number, default: 250 },
  brickGap: { type: Number, default: 2 },
  edgeColor: { type: String, default: '#00ff00' },
  showAllNumbers: { type: Boolean, default: false },
  labelSize: { type: Number, default: 1 },
  bricksPerRow: { type: Number, default: 0 },
  rows: { type: Number, default: 10 },
})

// ========== ССЫЛКИ И ПЕРЕМЕННЫЕ ==========
const containerRef = ref(null) // DOM-элемент для вставки canvas
let scene, camera, renderer, labelRenderer, controls, wallsGroup, groundMesh
let raycaster, mouse
let hoveredBrickMesh = null
let lastBrickGeometry, lastBrickMaterial // Общая геометрия/материал для всех кирпичей (для переиспользования)
let lastEdgesGeometry, lastLineMaterial // Геометрия рёбер и материал линий (подсветка граней кирпичей)
let animationId = null

const brickColor = 0xc75c3d // Цвет кирпича (оранжево-красный)
const groundColor = 0x4a5568 // Цвет фундамента (серо-синий)

// Ограничения для производительности: не рисовать все кирпичи, если их слишком много
const MAX_DISPLAY_ROWS = 25
const MAX_BRICKS_PER_WALL = 80

// ========== ИНИЦИАЛИЗАЦИЯ СЦЕНЫ ==========
function init() {
  if (!containerRef.value) return

  // Сцена и фон
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2332)

  // Камера: перспектива, размеры под контейнер
  const w = containerRef.value.clientWidth || 500
  const h = containerRef.value.clientHeight || 450
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(20, 12, 20)
  camera.lookAt(0, 0, 0)

  // Рендерер: WebGL, сглаживание, тени
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  // CSS2DRenderer для подписей-номеров на кирпичах
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(w, h)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.width = '100%'
  labelRenderer.domElement.style.height = '100%'
  labelRenderer.domElement.style.pointerEvents = 'none'
  labelRenderer.domElement.style.zIndex = '1'
  containerRef.value.appendChild(labelRenderer.domElement)

  // Raycaster для hover (определение кирпича под мышью)
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()

  // OrbitControls: вращение камеры мышью, масштаб колёсиком
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Освещение: рассеянный свет
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  // Основной направленный свет (отбрасывает тени)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
  dirLight.position.set(15, 25, 15)
  dirLight.castShadow = true
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  dirLight.shadow.camera.near = 0.5
  dirLight.shadow.camera.far = 100
  dirLight.shadow.camera.left = -40
  dirLight.shadow.camera.right = 40
  dirLight.shadow.camera.top = 40
  dirLight.shadow.camera.bottom = -40
  scene.add(dirLight)

  // Дополнительный заполняющий свет (холодный оттенок)
  const fillLight = new THREE.DirectionalLight(0xa0c4ff, 0.25)
  fillLight.position.set(-10, 10, -10)
  scene.add(fillLight)

  // Группа для всех стен (удобно очищать при пересчёте)
  wallsGroup = new THREE.Group()
  scene.add(wallsGroup)
}

// ========== ФУНДАМЕНТ (ПЛОСКОСТЬ) ==========
function addGround() {
  // Удаляем старый фундамент перед созданием нового
  if (groundMesh) {
    groundMesh.geometry.dispose()
    groundMesh.material.dispose()
    scene.remove(groundMesh)
  }

  const L = props.houseLength
  const W = props.houseWidth
  const geometry = new THREE.PlaneGeometry(L, W)
  const material = new THREE.MeshLambertMaterial({
    color: groundColor,
    side: THREE.DoubleSide,
  })
  groundMesh = new THREE.Mesh(geometry, material)
  groundMesh.rotation.x = -Math.PI / 2 // Поворачиваем горизонтально (Y вверх)
  groundMesh.receiveShadow = true
  groundMesh.position.y = 0
  scene.add(groundMesh)
}

// Удаление DOM-элементов лейблов (иначе при пересборке они накапливаются и дублируются)
function cleanupLabelElements(obj) {
  obj.traverse((child) => {
    if (child.isCSS2DObject && child.element?.parentNode) {
      child.element.parentNode.removeChild(child.element)
    }
  })
}

// ========== ПОСТРОЕНИЕ СТЕН ИЗ КИРПИЧЕЙ ==========
function buildWalls() {
  // Очистка: удаляем DOM лейблов, затем меши (без этого лейблы дублируются)
  while (wallsGroup.children.length > 0) {
    const mesh = wallsGroup.children[0]
    cleanupLabelElements(mesh)
    wallsGroup.remove(mesh)
  }
  lastBrickGeometry?.dispose()
  lastBrickMaterial?.dispose()
  lastEdgesGeometry?.dispose()
  lastLineMaterial?.dispose()

  // Размеры в метрах (мм / 1000)
  const L = props.houseLength / 2
  const W = props.houseWidth / 2
  const brickW = props.brickWidth / 1000
  const brickL = props.brickLength / 1000
  const brickH = props.brickHeight / 1000
  const gapM = props.brickGap / 1000

  const perimeter = 2 * (props.houseLength + props.houseWidth)
  const rowsCount = Math.min(Math.max(1, props.rows), MAX_DISPLAY_ROWS)

  // Распределение кирпичей по стенам (пропорционально длине стороны)
  const bricksFront = Math.min(
    Math.max(1, Math.ceil((props.houseLength / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )
  const bricksRight = Math.min(
    Math.max(1, Math.ceil((props.houseWidth / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )

  // Общая геометрия и материал для всех кирпичей (экономия памяти)
  lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
  lastBrickMaterial = new THREE.MeshLambertMaterial({
    color: brickColor,
    flatShading: true,
  })

  // Геометрия и материал рёбер (подсветка граней — кирпичи не сливаются в одну массу)
  lastEdgesGeometry = new THREE.EdgesGeometry(lastBrickGeometry)
  lastLineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(props.edgeColor),
    linewidth: 1,
  })

  // Смещение стены от контура фундамента (толщина кирпича + запас)
  const offset = brickL / 2 + 0.005

  // Конфиг четырёх стен: front, right, back, left
  // Порядок: фронт (угол 1) → право → зад → лево → снова угол 1. Первый кирпич — в углу (фронт-лево).
  const walls = [
    { bricks: bricksFront, length: props.houseLength, cx: 0, cz: -W, axis: 'x', xOff: 0, zOff: -offset },
    { bricks: bricksRight, length: props.houseWidth, cx: L, cz: 0, axis: 'z', xOff: offset, zOff: 0 },
    { bricks: bricksFront, length: props.houseLength, cx: 0, cz: W, axis: 'x', xOff: 0, zOff: offset },
    { bricks: bricksRight, length: props.houseWidth, cx: -L, cz: 0, axis: 'z', xOff: -offset, zOff: 0 },
  ]

  let brickNumber = 1
  const bricksInRow = 2 * bricksFront + 2 * bricksRight
  const baseFontSize = 10 * (props.labelSize || 1)

  // Порядок: ряд 0 по периметру (1 в углу), ряд 1, ряд 2… Первый — в углу (front-left).
  for (let row = 0; row < rowsCount; row++) {
    const y = row * (brickH + gapM) + brickH / 2
    const stepAlong = brickW + gapM
    let posInRow = 0

    walls.forEach((wall) => {
      for (let col = 0; col < wall.bricks; col++) {
        const isFirstInRow = posInRow === 0
        const isLastInRow = posInRow === bricksInRow - 1
        posInRow++

        const mesh = new THREE.Mesh(lastBrickGeometry, lastBrickMaterial)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const edges = new THREE.LineSegments(lastEdgesGeometry, lastLineMaterial)
        mesh.add(edges)

        const labelDiv = document.createElement('div')
        labelDiv.className = 'brick-label'
        labelDiv.textContent = brickNumber
        labelDiv.style.fontSize = `${baseFontSize}px`
        const labelObj = new CSS2DObject(labelDiv)
        labelObj.position.set(0, 0, 0)
        labelObj.center.set(0.5, 0.5)
        mesh.add(labelObj)

        mesh.userData = {
          number: brickNumber,
          isFirstInRow,
          isLastInRow,
          labelEl: labelDiv,
          labelObj, // CSS2DObject — видимость через .visible (рендерер перезаписывает style.display)
        }
        brickNumber++

        updateLabelVisibility(mesh, props.showAllNumbers, false)

        const along = (col + 0.5) * stepAlong - (wall.bricks * stepAlong) / 2

        if (wall.axis === 'x') {
          mesh.position.set(wall.cx + along, y, wall.cz + wall.zOff)
        } else {
          mesh.position.set(wall.cx + wall.xOff, y, wall.cz + along)
        }
        wallsGroup.add(mesh)
      }
    })
  }

  hoveredBrickMesh = null

  // Fallback: если кирпичей 0, рисуем хотя бы один
  if (wallsGroup.children.length === 0) {
    const mesh = new THREE.Mesh(lastBrickGeometry, lastBrickMaterial)
    mesh.add(new THREE.LineSegments(lastEdgesGeometry, lastLineMaterial))
    const labelDiv = document.createElement('div')
    labelDiv.className = 'brick-label'
    labelDiv.textContent = '1'
    labelDiv.style.fontSize = `${baseFontSize}px`
    const labelObj = new CSS2DObject(labelDiv)
    labelObj.center.set(0.5, 0.5)
    mesh.add(labelObj)
    mesh.userData = { number: 1, isFirstInRow: true, isLastInRow: true, labelEl: labelDiv, labelObj }
    mesh.position.set(0, brickH / 2, -W - brickL / 2)
    mesh.castShadow = true
    wallsGroup.add(mesh)
  }
}

// Видимость лейбла: галочка вкл — все номера; галочка выкл — только на кирпиче под мышью
// CSS2DRenderer перезаписывает element.style.display каждый кадр, поэтому управляем через .visible
function updateLabelVisibility(mesh, showAll, isHovered) {
  const { labelEl, labelObj } = mesh.userData || {}
  if (!labelEl || !labelObj) return
  const show = showAll || isHovered
  labelObj.visible = show
  labelEl.classList.toggle('brick-label-hover', isHovered)
}

function updateAllLabelsVisibility(showAll) {
  const val = showAll ?? props.showAllNumbers
  wallsGroup?.traverse((obj) => {
    if (obj.isMesh && obj.userData?.labelEl) {
      updateLabelVisibility(obj, val, obj === hoveredBrickMesh)
    }
  })
}

function onPointerMove(event) {
  if (!containerRef.value || !camera || !wallsGroup) return
  const rect = containerRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(wallsGroup.children)
  const hit = intersects[0]?.object
  if (hit !== hoveredBrickMesh) {
    if (hoveredBrickMesh?.userData?.labelEl) {
      updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
    }
    hoveredBrickMesh = hit || null
    if (hoveredBrickMesh?.userData?.labelEl) {
      updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, true)
    }
  }
}

function onPointerLeave() {
  if (hoveredBrickMesh?.userData?.labelEl) {
    updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
  }
  hoveredBrickMesh = null
}

// ========== ОБНОВЛЕНИЕ СЦЕНЫ ==========
function updateScene() {
  addGround()
  buildWalls()
}

// ========== АНИМАЦИОННЫЙ ЦИКЛ ==========
function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  if (labelRenderer) labelRenderer.render(scene, camera)
}

// ========== РЕСАЙЗ ==========
function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth || 500
  const h = Math.max(containerRef.value.clientHeight, 450)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  if (labelRenderer) labelRenderer.setSize(w, h)
}

// ========== LIFECYCLE ==========
onMounted(() => {
  init()
  updateScene()
  animate()
  window.addEventListener('resize', onResize)
  const el = containerRef.value
  if (el) {
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)
  }
})

onUnmounted(() => {
  // Очистка: останавливаем анимацию, удаляем canvas, освобождаем ресурсы
  window.removeEventListener('resize', onResize)
  const el = containerRef.value
  if (el) {
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerleave', onPointerLeave)
  }
  if (animationId) cancelAnimationFrame(animationId)
  if (containerRef.value) {
    try {
      if (renderer?.domElement) containerRef.value.removeChild(renderer.domElement)
      if (labelRenderer?.domElement) containerRef.value.removeChild(labelRenderer.domElement)
    } catch (_) {}
  }
  renderer?.dispose()
  controls?.dispose()
  wallsGroup?.traverse?.((obj) => {
    if (obj.isCSS2DObject && obj.element?.parentNode) {
      obj.element.parentNode.removeChild(obj.element)
    }
  })
  wallsGroup?.clear?.()
})

// ========== РЕАКТИВНОСТЬ ==========
// Перестраиваем сцену при изменении параметров (кроме showAllNumbers — только видимость)
watch(
  () => [
    props.houseLength,
    props.houseWidth,
    props.brickWidth,
    props.brickLength,
    props.brickHeight,
    props.brickGap,
    props.edgeColor,
    props.labelSize,
    props.bricksPerRow,
    props.rows,
  ],
  () => updateScene(),
  { deep: true }
)
// Показать/скрыть номера — срабатывает при клике на галочку и при монтировании
watch(
  () => props.showAllNumbers,
  (newVal) => updateAllLabelsVisibility(newVal),
  { immediate: true }
)
</script>

<style scoped>
.canvas-wrapper {
  position: relative;
  width: 100%;
  min-height: 450px;
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.canvas-wrapper :deep(canvas) {
  display: block;
  border-radius: 8px;
}

/* Стили для подписей-номеров кирпичей (CSS2DObject) */
:deep(.brick-label) {
  color: #000;
  font-weight: bold;
  white-space: nowrap;
  padding: 2px 4px;
  background: #ffeb3b;
  border-radius: 4px;
}

:deep(.brick-label.brick-label-hover) {
  background: #1b5e20;
  color: #fff;
}
</style>
