<template>
  <!-- Контейнер, в который вставляются WebGL-канвас и слой с подписями -->
  <div ref="containerRef" class="canvas-wrapper" />
</template>

<script setup>
/**
 * HouseCanvas — 3D сцена: плоскость дома (фундамент) + кирпичи по периметру.
 * Логика отталкивания: центры кирпичей смещены от края прямоугольника В СТОРОНУ ЦЕНТРА на halfW вдоль стены и halfL внутрь (см. walls и buildDistributionWalls).
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

// ========== ПРОПСЫ ==========
// Входные данные от родителя: размеры в м/мм, цвета в HEX, флаги и счётчики
const props = defineProps({
  houseLength: { type: Number, default: 10 },       // длина дома (м), половина плоскости по X
  houseWidth: { type: Number, default: 10 },       // ширина дома (м), половина плоскости по Z
  brickWidth: { type: Number, default: 500 },     // ширина кирпича (мм), вдоль ряда
  brickLength: { type: Number, default: 625 },     // длина кирпича (мм), вглубь стены
  brickHeight: { type: Number, default: 250 },     // высота кирпича (мм)
  brickGap: { type: Number, default: 2 },         // зазор между кирпичами (мм)
  edgeColor: { type: String, default: '#00ff00' }, // цвет линий рёбер кирпичей
  groundColor: { type: String, default: '#4a5568' }, // цвет плоскости фундамента
  showAllNumbers: { type: Boolean, default: false }, // показывать все номера или только при hover
  showBrickDimensions: { type: Boolean, default: false }, // стрелки X, Y, Z с размерами кирпича
  labelSize: { type: Number, default: 1 },        // масштаб подписи (0.5–2)
  bricksPerRow: { type: Number, default: 0 },     // всего кирпичей в одном ряду по периметру
  rows: { type: Number, default: 10 },             // количество рядов
  distributionBrickCount: { type: Number, default: 0 }, // 0 = полная кладка, >0 = режим «N кирпичей»
})

// ========== ССЫЛКИ И ПЕРЕМЕННЫЕ ==========
const containerRef = ref(null)                    // div, куда монтируются canvas'ы
let scene, camera, renderer, labelRenderer, controls, wallsGroup, groundMesh
let raycaster, mouse                               // луч из камеры для определения кирпича под курсором
let hoveredBrickMesh = null                        // меш кирпича, над которым сейчас курсор
let lastBrickGeometry, lastBrickMaterial           // одна геометрия/материал на все кирпичи (экономия памяти)
let lastEdgesGeometry, lastLineMaterial            // рёбра кирпичей (контур), общие для всех
let closureBrickMaterial, closureBrickLineMaterial // красные для замыкающих кирпичей
let closureGeometries = []                         // геометрии замыкающих кирпичей — для dispose
const closureBrickColor = 0xff0000                 // красный цвет замыкающего кирпича
let animationId = null                             // id requestAnimationFrame для остановки цикла

const brickColor = 0xc75c3d                        // цвет меша кирпича (оранжево-красный)
const brickMargin = 0.97                           // масштаб меша: 0.97 = визуальный зазор ~3% между кирпичами

const MAX_DISPLAY_ROWS = 25                        // не рисовать больше рядов (производительность)
const MAX_BRICKS_PER_WALL = 80                     // макс. кирпичей на одну стену

// ========== ИНИЦИАЛИЗАЦИЯ СЦЕНЫ ==========
function init() {
  if (!containerRef.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2332)     // тёмно-синий фон

  const w = containerRef.value.clientWidth || 500
  const h = containerRef.value.clientHeight || 450
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(20, 12, 20)                   // точка обзора
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

  labelRenderer = new CSS2DRenderer()              // рисует HTML-подписи (номера) поверх сцены
  labelRenderer.setSize(w, h)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.left = '0'
  labelRenderer.domElement.style.width = '100%'
  labelRenderer.domElement.style.height = '100%'
  labelRenderer.domElement.style.pointerEvents = 'none'  // клики проходят к WebGL
  labelRenderer.domElement.style.zIndex = '1'
  containerRef.value.appendChild(labelRenderer.domElement)

  raycaster = new THREE.Raycaster()                // луч из камеры в точку экрана
  mouse = new THREE.Vector2()                       // нормализованные координаты мыши (-1..1)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

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

  const fillLight = new THREE.DirectionalLight(0xa0c4ff, 0.25)
  fillLight.position.set(-10, 10, -10)
  scene.add(fillLight)

  wallsGroup = new THREE.Group()                  // сюда добавляются все меши кирпичей
  scene.add(wallsGroup)
}

// ========== СТРЕЛКИ РАЗМЕРОВ КИРПИЧА (X, Y, Z) — у каждого кирпича ==========
const ARROW_COLOR = 0xffff00
const LABEL_BG = '#e67e22'
const LABEL_TEXT = '#000000'

function addDimensionArrowsToBrick(mesh, brickW, brickH, brickL, opts = {}) {
  const { isClosure = false, closureLengthMm = null, closureAxis = 'z' } = opts
  const closureLen = closureLengthMm != null ? closureLengthMm / 1000 : null
  const dimZ = closureLen != null && closureAxis === 'z' ? closureLen : brickL
  const vertex = new THREE.Vector3(-brickW / 2, -brickH / 2, -dimZ / 2)
  const arrowColor = isClosure ? 0xff0000 : ARROW_COLOR
  const labelBg = isClosure ? '#ff0000' : LABEL_BG
  const labelText = isClosure ? '#ffffff' : LABEL_TEXT

  const axes = [
    { axis: 'x', dir: new THREE.Vector3(1, 0, 0), len: brickW, label: props.brickWidth },
    { axis: 'y', dir: new THREE.Vector3(0, 1, 0), len: brickH, label: props.brickHeight },
    { axis: 'z', dir: new THREE.Vector3(0, 0, 1), len: brickL, label: props.brickLength },
  ]
  axes.forEach(({ axis, dir, len, label }) => {
    const useLen = closureLen != null && axis === closureAxis ? closureLen : len
    const useLabel = closureLen != null && axis === closureAxis ? Math.round(closureLengthMm) : label
    const arrow = new THREE.ArrowHelper(dir, vertex, useLen, arrowColor)
    arrow.userData.isDimensionArrow = true
    mesh.add(arrow)
    const mid = vertex.clone().add(dir.clone().multiplyScalar(useLen / 2))
    const div = document.createElement('div')
    div.className = isClosure ? 'dimension-label dimension-label-closure' : 'dimension-label'
    div.textContent = String(useLabel)
    div.style.color = labelText
    div.style.backgroundColor = labelBg
    div.style.fontSize = `${10 * (props.labelSize || 1)}px`
    div.style.padding = '2px 6px'
    div.style.borderRadius = '4px'
    div.style.fontWeight = 'bold'
    const labelObj = new CSS2DObject(div)
    labelObj.position.copy(mid)
    labelObj.userData.isDimensionArrow = true
    mesh.add(labelObj)
  })
}

function removeDimensionArrowsFromBrick(mesh) {
  const toRemove = []
  mesh.traverse((child) => {
    if (child.userData?.isDimensionArrow) toRemove.push(child)
  })
  toRemove.forEach((obj) => {
    mesh.remove(obj)
    if (obj.isCSS2DObject && obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element)
  })
}

function updateDimensionsArrows() {
  if (!wallsGroup) return
  wallsGroup.traverse((obj) => {
    if (obj.isMesh && obj.userData?.number != null) {
      removeDimensionArrowsFromBrick(obj)
      if (props.showBrickDimensions) {
        const brickW = props.brickWidth / 1000
        const brickH = props.brickHeight / 1000
        const brickL = props.brickLength / 1000
        const opts = obj.userData?.isClosure && obj.userData?.closureLengthMm != null
          ? { isClosure: true, closureLengthMm: obj.userData.closureLengthMm, closureAxis: 'z' }
          : {}
        addDimensionArrowsToBrick(obj, brickW, brickH, brickL, opts)
      }
    }
  })
}

// ========== ФУНДАМЕНТ (ПЛОСКОСТЬ) ==========
// Плоскость = «дом» по размеру houseLength × houseWidth, лежит в y=0, кирпичи стоят на ней.
function addGround() {
  if (groundMesh) {
    groundMesh.geometry.dispose()
    groundMesh.material.dispose()
    scene.remove(groundMesh)
  }

  const L = props.houseLength                       // полная длина (м), плоскость по X
  const W = props.houseWidth                        // полная ширина (м), плоскость по Z
  const geometry = new THREE.PlaneGeometry(L, W)
  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(props.groundColor || '#4a5568'),
    side: THREE.DoubleSide,
  })
  groundMesh = new THREE.Mesh(geometry, material)
  groundMesh.rotation.x = -Math.PI / 2             // плоскость из XY в XZ, ось Y вверх
  groundMesh.receiveShadow = true
  groundMesh.position.y = 0
  scene.add(groundMesh)
}

// Единичные векторы «вдоль стены» для сдвига пересекающегося кирпича: front +X, right +Z, back -X, left -Z
const WALL_DIRECTIONS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, -1),
]

// Устраняет пересечение двух кирпичей: сдвигаем кирпич с большим номером на halfLength вдоль своей стены.
function fixIntersections(brickL, brickMargin) {
  if (!wallsGroup) return
  const meshes = []
  wallsGroup.traverse((obj) => {
    if (obj.isMesh && obj.userData?.number != null && obj.userData?.wallIndex != null) {
      meshes.push(obj)
    }
  })
  const boxA = new THREE.Box3()
  const boxB = new THREE.Box3()
  const halfLength = (brickL * brickMargin) / 2   // половина длины кирпича (с учётом масштаба)
  let fixed
  for (let iter = 0; iter < 10; iter++) {
    wallsGroup.updateMatrixWorld(true)
    fixed = false
    for (let i = 0; i < meshes.length; i++) {
      for (let j = i + 1; j < meshes.length; j++) {
        boxA.setFromObject(meshes[i])
        boxB.setFromObject(meshes[j])
        if (!boxA.intersectsBox(boxB)) continue

        const [toShift] = meshes[i].userData.number > meshes[j].userData.number ? [meshes[i], meshes[j]] : [meshes[j], meshes[i]]
        const dir = WALL_DIRECTIONS[toShift.userData.wallIndex].clone()
        toShift.position.add(dir.multiplyScalar(halfLength))
        fixed = true
      }
    }
    if (!fixed) break
  }
}

// Убирает DOM-элементы подписей из контейнера CSS2DRenderer, чтобы при пересборке не плодились дубли.
function cleanupLabelElements(obj) {
  obj.traverse((child) => {
    if (child.isCSS2DObject && child.element?.parentNode) {
      child.element.parentNode.removeChild(child.element)
    }
  })
}

// ========== ПОЭТАПНОЕ РАСПРЕДЕЛЕНИЕ (N КИРПИЧЕЙ) ==========
// Рисует N кирпичей по периметру. При замыкании круга — новый ряд со смещением на полкирпича.
// Замыкающий кирпич (X+Y, Y<=X): последний перед углом удлиняется до заполнения остатка.
function buildDistributionWalls(L, W, brickW, brickL, brickH, gapM) {
  const halfW = brickW / 2
  const halfL = brickL / 2
  const baseFontSize = 10 * (props.labelSize || 1)
  const n = Math.max(1, Math.floor(props.distributionBrickCount))

  const brickAlongPath = Math.max(brickW, brickL)
  const halfBrickAlongPath = brickAlongPath / 2
  const halfExtent = brickAlongPath * brickMargin / 2
  const step = brickAlongPath * brickMargin + gapM

  const segs = [
    { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: -L + halfL + t * (2 * L - brickL), z: -W + halfW, wallIndex: 0, rotate90: true }) },
    { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: L - halfL, z: -W + halfW + t * (2 * W - brickW), wallIndex: 1, rotate90: false }) },
    { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: L - halfL - t * (2 * L - brickL), z: W - halfW, wallIndex: 2, rotate90: true }) },
    { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: -L + halfL, z: W - halfW - t * (2 * W - brickW), wallIndex: 3, rotate90: false }) },
  ]

  const perimeter = segs.reduce((sum, s) => sum + s.len, 0)
  const segEnds = []
  let acc = 0
  for (let s = 0; s < segs.length; s++) {
    if (segs[s].len > 0) acc += segs[s].len
    segEnds.push(acc)
  }
  const bricksPerLap = perimeter > 1e-6 ? Math.max(1, Math.floor(perimeter / step)) : n

  function pointAtDistance(dist) {
    const d = perimeter > 1e-6 ? dist % perimeter : 0
    let a = 0
    for (let s = 0; s < segs.length; s++) {
      if (segs[s].len <= 0) continue
      if (a + segs[s].len >= d) {
        const t = (d - a) / segs[s].len
        return segs[s].get(Math.min(1, Math.max(0, t)))
      }
      a += segs[s].len
    }
    return segs[segs.length - 1].get(1)
  }

  function getSegmentEnd(dist) {
    const d = perimeter > 1e-6 ? dist % perimeter : 0
    for (let s = 0; s < segEnds.length; s++) {
      if (d < segEnds[s]) return segEnds[s]
    }
    return perimeter
  }

  lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
  lastBrickMaterial = new THREE.MeshLambertMaterial({ color: brickColor, flatShading: true })
  closureBrickMaterial = new THREE.MeshLambertMaterial({ color: closureBrickColor, flatShading: true })
  lastEdgesGeometry = new THREE.EdgesGeometry(lastBrickGeometry)
  lastLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(props.edgeColor), linewidth: 1 })
  closureBrickLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('#ff0000'), linewidth: 1 })

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / bricksPerLap)
    const posInLap = i % bricksPerLap
    const offsetForRow = (row % 2) * halfBrickAlongPath
    const dist = (offsetForRow + posInLap * step) % (perimeter || 1)
    const y = row * (brickH + gapM) + brickH / 2

    const segmentEnd = getSegmentEnd(dist)
    const distFromEdgeToCorner = segmentEnd - (dist + halfExtent)   // расстояние от края кирпича до угла
    const needClosure = distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < brickAlongPath
    const closureLenM = needClosure ? Math.min(segmentEnd - dist + halfExtent, 2 * brickAlongPath) : null
    const closureLen = closureLenM != null ? closureLenM / brickMargin : null

    const posDist = needClosure ? dist + distFromEdgeToCorner / 2 : dist
    const pt = pointAtDistance(posDist)

    let geom = lastBrickGeometry
    if (closureLen != null) {
      const g = new THREE.BoxGeometry(brickW, brickH, closureLen)
      closureGeometries.push(g)
      geom = g
    }

    const mat = needClosure ? closureBrickMaterial : lastBrickMaterial
    const lineMat = needClosure ? closureBrickLineMaterial : lastLineMaterial
    const mesh = new THREE.Mesh(geom, mat)
    mesh.scale.set(brickMargin, brickMargin, brickMargin)
    mesh.castShadow = true
    mesh.receiveShadow = true
    const edgesGeom = geom === lastBrickGeometry ? lastEdgesGeometry : new THREE.EdgesGeometry(geom)
    if (geom !== lastBrickGeometry) closureGeometries.push(edgesGeom)
    mesh.add(new THREE.LineSegments(edgesGeom, lineMat))
    const labelDiv = document.createElement('div')
    labelDiv.className = needClosure ? 'brick-label brick-label-closure' : 'brick-label'
    labelDiv.textContent = i + 1
    labelDiv.style.fontSize = `${baseFontSize}px`
    const labelObj = new CSS2DObject(labelDiv)
    labelObj.position.set(0, 0, 0)
    labelObj.center.set(0.5, 0.5)
    mesh.add(labelObj)
    mesh.userData = {
      number: i + 1,
      wallIndex: pt.wallIndex,
      row,
      labelEl: labelDiv,
      labelObj,
      isClosure: needClosure,
      closureLengthMm: closureLenM != null ? Math.round(closureLenM * 1000) : null,
    }
    updateLabelVisibility(mesh, props.showAllNumbers, false)
    if (pt.rotate90) mesh.rotation.y = Math.PI / 2
    mesh.position.set(pt.x, y, pt.z)
    wallsGroup.add(mesh)
  }

  hoveredBrickMesh = null
}

// ========== ПОСТРОЕНИЕ СТЕН ИЗ КИРПИЧЕЙ (ПОЛНАЯ КЛАДКА) ==========
function buildWalls() {
  while (wallsGroup.children.length > 0) {
    const mesh = wallsGroup.children[0]
    cleanupLabelElements(mesh)
    wallsGroup.remove(mesh)
  }
  lastBrickGeometry?.dispose()
  lastBrickMaterial?.dispose()
  lastEdgesGeometry?.dispose()
  lastLineMaterial?.dispose()
  closureBrickMaterial?.dispose()
  closureBrickLineMaterial?.dispose()
  closureGeometries.forEach((g) => g.dispose())
  closureGeometries = []

  const L = props.houseLength / 2   // половина длины дома (м), край плоскости по X
  const W = props.houseWidth / 2    // половина ширины дома (м), край плоскости по Z
  const brickW = props.brickWidth / 1000
  const brickL = props.brickLength / 1000
  const brickH = props.brickHeight / 1000
  const gapM = props.brickGap / 1000

  const N = Math.max(0, Number(props.distributionBrickCount))
  if (N > 0) {
    buildDistributionWalls(L, W, brickW, brickL, brickH, gapM)
    return
  }

  const perimeter = 2 * (props.houseLength + props.houseWidth)
  const rowsCount = Math.min(Math.max(1, props.rows), MAX_DISPLAY_ROWS)

  // Делим bricksPerRow между четырьмя стенами пропорционально длине стороны
  const bricksFront = Math.min(
    Math.max(1, Math.ceil((props.houseLength / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )
  const bricksRight = Math.min(
    Math.max(1, Math.ceil((props.houseWidth / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )

  lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
  lastBrickMaterial = new THREE.MeshLambertMaterial({ color: brickColor, flatShading: true })
  closureBrickMaterial = new THREE.MeshLambertMaterial({ color: closureBrickColor, flatShading: true })
  lastEdgesGeometry = new THREE.EdgesGeometry(lastBrickGeometry)
  lastLineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(props.edgeColor),
    linewidth: 1,
  })
  closureBrickLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('#ff0000'), linewidth: 1 })

  // Стартовая точка первого кирпича каждой стены = угол + отступ (halfL, halfW), чтобы не свисал с прямоугольника.
  const halfL = brickL / 2
  const halfW = brickW / 2

  // startX, startZ — центр первого кирпича; segmentLen — длина стены; замыкающий кирпич = X+Y, Y<=X (макс 2X).
  const walls = [
    { bricks: bricksFront, startX: -L + halfL, startZ: -W + halfW, axis: 'x', sign: 1, rotate90: true, segmentLen: 2 * L - brickL },
    { bricks: bricksRight, startX: L - halfL, startZ: -W + halfW, axis: 'z', sign: 1, rotate90: false, segmentLen: 2 * W - brickW },
    { bricks: bricksFront, startX: L - halfL, startZ: W - halfW, axis: 'x', sign: -1, rotate90: true, segmentLen: 2 * L - brickL },
    { bricks: bricksRight, startX: -L + halfL, startZ: W - halfW, axis: 'z', sign: -1, rotate90: false, segmentLen: 2 * W - brickW },
  ]

  let brickNumber = 1
  const bricksInRow = 2 * bricksFront + 2 * bricksRight
  const baseFontSize = 10 * (props.labelSize || 1)

  const extentAlongWall = Math.max(brickW, brickL) * brickMargin
  const stepAlong = extentAlongWall + gapM   // шаг между центрами вдоль стены (без проникновения)

  // X = размер кирпича вдоль стены; Y = остаток до угла; замыкающий кирпич = X+Y, Y<=X (макс 2X).
  const extentBrick = (w) => (w.rotate90 ? brickL : brickW)

  for (let row = 0; row < rowsCount; row++) {
    const y = row * (brickH + gapM) + brickH / 2   // центр кирпича по высоте (низ на плоскости при row=0)
    let posInRow = 0

    walls.forEach((wall, wallIndex) => {
      for (let col = 0; col < wall.bricks; col++) {
        const isFirstInRow = posInRow === 0
        const isLastInRow = posInRow === bricksInRow - 1
        posInRow++

        const isLastOnWall = col === wall.bricks - 1
        const X = extentBrick(wall)
        const halfX = (X * brickMargin) / 2
        const lastCenterAlong = (wall.bricks - 1) * stepAlong
        const lastFarEdge = lastCenterAlong + halfX
        const distFromEdgeToCorner = wall.segmentLen - lastFarEdge   // расстояние от края кирпича до угла
        const needClosure = isLastOnWall && distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < X
        const closureLenM = needClosure ? Math.min(wall.segmentLen - lastCenterAlong + halfX, 2 * X) : null
        const closureLen = closureLenM != null ? closureLenM / brickMargin : null

        let geom = lastBrickGeometry
        if (closureLen != null) {
          const g = new THREE.BoxGeometry(brickW, brickH, closureLen)
          closureGeometries.push(g)
          geom = g
        }

        const mat = needClosure ? closureBrickMaterial : lastBrickMaterial
        const lineMat = needClosure ? closureBrickLineMaterial : lastLineMaterial
        const mesh = new THREE.Mesh(geom, mat)
        mesh.scale.set(brickMargin, brickMargin, brickMargin)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const edgesGeom = geom === lastBrickGeometry ? lastEdgesGeometry : new THREE.EdgesGeometry(geom)
        if (geom !== lastBrickGeometry) closureGeometries.push(edgesGeom)
        const edges = new THREE.LineSegments(edgesGeom, lineMat)
        mesh.add(edges)

        const labelDiv = document.createElement('div')
        labelDiv.className = needClosure ? 'brick-label brick-label-closure' : 'brick-label'
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
          wallIndex,
          labelEl: labelDiv,
          labelObj,
          isClosure: needClosure,
          closureLengthMm: closureLenM != null ? Math.round(closureLenM * 1000) : null,
        }
        brickNumber++

        updateLabelVisibility(mesh, props.showAllNumbers, false)

        // Позиция: центр смещён на distFromEdgeToCorner/2 к углу для замыкающего кирпича (отталкивание от предыдущего)
        const posOffset = needClosure ? distFromEdgeToCorner / 2 : 0
        const along = col * stepAlong + posOffset
        if (wall.rotate90) mesh.rotation.y = Math.PI / 2
        if (wall.axis === 'x') {
          mesh.position.set(wall.startX + wall.sign * along, y, wall.startZ)
        } else {
          mesh.position.set(wall.startX, y, wall.startZ + wall.sign * along)
        }
        wallsGroup.add(mesh)
      }
    })
  }

  wallsGroup.updateMatrixWorld(true)
  fixIntersections(brickL, brickMargin)

  hoveredBrickMesh = null

  if (wallsGroup.children.length === 0) {
    const mesh = new THREE.Mesh(lastBrickGeometry, lastBrickMaterial)
    mesh.scale.set(brickMargin, brickMargin, brickMargin)
    mesh.add(new THREE.LineSegments(lastEdgesGeometry, lastLineMaterial))
    const labelDiv = document.createElement('div')
    labelDiv.className = 'brick-label'
    labelDiv.textContent = '1'
    labelDiv.style.fontSize = `${baseFontSize}px`
    const labelObj = new CSS2DObject(labelDiv)
    labelObj.center.set(0.5, 0.5)
    mesh.add(labelObj)
    mesh.userData = { number: 1, isFirstInRow: true, isLastInRow: true, wallIndex: 0, labelEl: labelDiv, labelObj }
    mesh.rotation.y = Math.PI / 2
    mesh.position.set(-L + halfL, brickH / 2, -W + halfW)   // один кирпич в углу: отступ halfL, halfW от края
    mesh.castShadow = true
    wallsGroup.add(mesh)
  }
}

// Показ/скрытие подписи одного кирпича. Управляем .visible у CSS2DObject (display каждый кадр перезаписывает рендерер).
function updateLabelVisibility(mesh, showAll, isHovered) {
  const { labelEl, labelObj } = mesh.userData || {}
  if (!labelEl || !labelObj) return
  const show = showAll || isHovered
  labelObj.visible = show
  labelEl.classList.toggle('brick-label-hover', isHovered)
}

// Проходит по всем кирпичам и выставляет видимость подписи (все или только под курсором).
function updateAllLabelsVisibility(showAll) {
  const val = showAll ?? props.showAllNumbers
  wallsGroup?.traverse((obj) => {
    if (obj.isMesh && obj.userData?.labelEl) {
      updateLabelVisibility(obj, val, obj === hoveredBrickMesh)
    }
  })
}

// Курсор движется: переводим координаты в -1..1, пускаем луч, находим первый пересечённый меш — это hover-кирпич.
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

// Курсор покинул контейнер — снимаем подсветку номера.
function onPointerLeave() {
  if (hoveredBrickMesh?.userData?.labelEl) {
    updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
  }
  hoveredBrickMesh = null
}

function updateScene() {
  addGround()
  buildWalls()
  updateDimensionsArrows()
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
  if (labelRenderer) labelRenderer.render(scene, camera)
}

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

// При изменении любого из этих пропсов пересобираем сцену (фундамент + стены).
watch(
  () => [
    props.houseLength,
    props.houseWidth,
    props.brickWidth,
    props.brickLength,
    props.brickHeight,
    props.brickGap,
    props.edgeColor,
    props.groundColor,
    props.labelSize,
    props.bricksPerRow,
    props.rows,
    props.distributionBrickCount,
  ],
  () => updateScene(),
  { deep: true }
)
// Только видимость подписей: при смене галочки «Показать все номера» обновляем без пересборки сцены.
watch(
  () => props.showAllNumbers,
  (newVal) => updateAllLabelsVisibility(newVal),
  { immediate: true }
)
// Стрелки размеров кирпича: обновляем при смене галочки (без пересборки сцены).
watch(
  () => props.showBrickDimensions,
  () => updateDimensionsArrows(),
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

:deep(.brick-label.brick-label-closure),
:deep(.brick-label.brick-label-closure.brick-label-hover) {
  background: #ff0000 !important;
  color: #fff !important;
}

/* Подписи размеров кирпича (стрелки X, Y, Z): чёрный текст на оранжевом фоне */
:deep(.dimension-label) {
  color: #000 !important;
  background: #e67e22 !important;
  white-space: nowrap;
}

:deep(.dimension-label.dimension-label-closure) {
  color: #fff !important;
  background: #ff0000 !important;
}
</style>
