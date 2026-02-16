<template>
  <div ref="containerRef" class="canvas-wrapper" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const props = defineProps({
  houseLength: { type: Number, default: 10 },
  houseWidth: { type: Number, default: 10 },
  brickWidth: { type: Number, default: 120 },
  brickLength: { type: Number, default: 250 },
  brickHeight: { type: Number, default: 65 },
  bricksPerRow: { type: Number, default: 0 },
  rows: { type: Number, default: 10 },
})

const containerRef = ref(null)
let scene, camera, renderer, controls, wallsGroup, groundMesh
let lastBrickGeometry, lastBrickMaterial
let animationId = null

const brickColor = 0xc75c3d
const groundColor = 0x4a5568

const MAX_DISPLAY_ROWS = 25
const MAX_BRICKS_PER_WALL = 80

function init() {
  if (!containerRef.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2332)

  const w = containerRef.value.clientWidth || 500
  const h = containerRef.value.clientHeight || 450
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(20, 12, 20)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  containerRef.value.appendChild(renderer.domElement)

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

  wallsGroup = new THREE.Group()
  scene.add(wallsGroup)
}

function addGround() {
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
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.receiveShadow = true
  groundMesh.position.y = 0
  scene.add(groundMesh)
}

function buildWalls() {
  while (wallsGroup.children.length > 0) {
    wallsGroup.remove(wallsGroup.children[0])
  }
  lastBrickGeometry?.dispose()
  lastBrickMaterial?.dispose()

  const L = props.houseLength / 2
  const W = props.houseWidth / 2
  const brickW = props.brickWidth / 1000
  const brickL = props.brickLength / 1000
  const brickH = props.brickHeight / 1000

  const perimeter = 2 * (props.houseLength + props.houseWidth)
  const rowsCount = Math.min(Math.max(1, props.rows), MAX_DISPLAY_ROWS)

  const bricksFront = Math.min(
    Math.max(1, Math.ceil((props.houseLength / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )
  const bricksRight = Math.min(
    Math.max(1, Math.ceil((props.houseWidth / perimeter) * props.bricksPerRow)),
    MAX_BRICKS_PER_WALL
  )

  lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
  lastBrickMaterial = new THREE.MeshLambertMaterial({
    color: brickColor,
    flatShading: true,
  })

  const offset = brickL / 2 + 0.005

  const walls = [
    { bricks: bricksFront, length: props.houseLength, cx: 0, cz: -W, axis: 'x', xOff: 0, zOff: -offset },
    { bricks: bricksRight, length: props.houseWidth, cx: L, cz: 0, axis: 'z', xOff: offset, zOff: 0 },
    { bricks: bricksFront, length: props.houseLength, cx: 0, cz: W, axis: 'x', xOff: 0, zOff: offset },
    { bricks: bricksRight, length: props.houseWidth, cx: -L, cz: 0, axis: 'z', xOff: -offset, zOff: 0 },
  ]

  walls.forEach((wall) => {
    const step = wall.length / wall.bricks
    for (let col = 0; col < wall.bricks; col++) {
      for (let row = 0; row < rowsCount; row++) {
        const mesh = new THREE.Mesh(lastBrickGeometry, lastBrickMaterial)
        mesh.castShadow = true
        mesh.receiveShadow = true

        const along = (col + 0.5) * step - wall.length / 2
        const y = row * brickH + brickH / 2

        if (wall.axis === 'x') {
          mesh.position.set(wall.cx + along, y, wall.cz + wall.zOff)
        } else {
          mesh.position.set(wall.cx + wall.xOff, y, wall.cz + along)
        }
        wallsGroup.add(mesh)
      }
    }
  })

  if (wallsGroup.children.length === 0) {
    const mesh = new THREE.Mesh(lastBrickGeometry, lastBrickMaterial)
    mesh.position.set(0, brickH / 2, -W - brickL / 2)
    mesh.castShadow = true
    wallsGroup.add(mesh)
  }
}

function updateScene() {
  addGround()
  buildWalls()
}

function animate() {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth || 500
  const h = Math.max(containerRef.value.clientHeight, 450)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  init()
  updateScene()
  animate()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (animationId) cancelAnimationFrame(animationId)
  if (containerRef.value && renderer?.domElement) {
    try {
      containerRef.value.removeChild(renderer.domElement)
    } catch (_) {}
  }
  renderer?.dispose()
  controls?.dispose()
  wallsGroup?.clear?.()
})

watch(
  () => [
    props.houseLength,
    props.houseWidth,
    props.brickWidth,
    props.brickLength,
    props.brickHeight,
    props.bricksPerRow,
    props.rows,
  ],
  () => updateScene(),
  { deep: true }
)
</script>

<style scoped>
.canvas-wrapper {
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
</style>
