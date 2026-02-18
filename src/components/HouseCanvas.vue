<template>
  <div ref="containerRef" class="canvas-wrapper" />
</template>

<script setup>
/**
 * HouseCanvas — 3D сцена: плоскость дома (фундамент) + кирпичи по периметру.
 * Логика сцены — useHouseScene, логика кирпичей — useBrickWalls.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useHouseScene } from '../composables/useHouseScene.js'
import { useBrickWalls } from '../composables/useBrickWalls.js'

const props = defineProps({
  houseLength: { type: Number, default: 10 },
  houseWidth: { type: Number, default: 10 },
  brickWidth: { type: Number, default: 500 },
  brickLength: { type: Number, default: 625 },
  brickHeight: { type: Number, default: 250 },
  brickGap: { type: Number, default: 2 },
  edgeColor: { type: String, default: '#00ff00' },
  gapColor: { type: String, default: '#888888' },
  groundColor: { type: String, default: '#4a5568' },
  showAllNumbers: { type: Boolean, default: false },
  showBrickSides: { type: Boolean, default: false },
  showBrickDimensions: { type: Boolean, default: false },
  showBrickDistances: { type: Boolean, default: false },
  labelSize: { type: Number, default: 1 },
  distributionBrickCount: { type: Number, default: 0 },
})

const emit = defineEmits(['brick-distances', 'brick-hover', 'camera-position'])

const containerRef = ref(null)

const sceneApi = useHouseScene(containerRef)
const brickApi = useBrickWalls(props, emit, () => sceneApi.getSceneRefs())

function updateScene() {
  sceneApi.addGround({
    houseLength: props.houseLength,
    houseWidth: props.houseWidth,
    groundColor: props.groundColor,
  })
  brickApi.buildWalls()
  brickApi.updateDimensionsArrows()
  if (props.showBrickDistances) {
    const refs = sceneApi.getSceneRefs()
    refs.wallsGroup?.updateMatrixWorld?.(true)
    emit('brick-distances', brickApi.getBrickDistances())
  }
}

let lastCameraEmit = 0
function animate() {
  const id = requestAnimationFrame(animate)
  sceneApi.setAnimationId(id)
  const refs = sceneApi.getSceneRefs()
  refs.controls?.update?.()

  const stripe = brickApi.getStripeOverlay()
  if (stripe?.userData?.stripeUniforms) {
    stripe.userData.stripeUniforms.time.value = performance.now() * 0.001
  }

  const fv = sceneApi.getFourViewRefs()
  if (fv.fourViewMode() && refs.renderer && containerRef.value) {
    const w = containerRef.value.clientWidth || 500
    const h = containerRef.value.clientHeight || 450
    const hw = w / 2
    const hh = h / 2
    const origVP = refs.renderer.getViewport(new THREE.Vector4())
    const origClear = refs.renderer.getClearColor(new THREE.Color())
    refs.renderer.setScissorTest(true)
    refs.renderer.setClearColor(0x1a2332, 1)
    if (fv.camTop) {
      fv.camTop.position.set(0, fv.CAM_DIST, 0)
      fv.camTop.lookAt(0, 0, 0)
      fv.camTop.aspect = hw / hh
      fv.camTop.updateProjectionMatrix()
      refs.renderer.setViewport(0, hh, hw, hh)
      refs.renderer.setScissor(0, hh, hw, hh)
      refs.renderer.clear()
      refs.renderer.render(refs.scene, fv.camTop)
    }
    if (fv.camFront) {
      fv.camFront.position.set(0, 0, fv.CAM_DIST)
      fv.camFront.lookAt(0, 0, 0)
      fv.camFront.aspect = hw / hh
      fv.camFront.updateProjectionMatrix()
      refs.renderer.setViewport(hw, hh, hw, hh)
      refs.renderer.setScissor(hw, hh, hw, hh)
      refs.renderer.clear()
      refs.renderer.render(refs.scene, fv.camFront)
    }
    if (fv.camRight) {
      fv.camRight.position.set(fv.CAM_DIST, 0, 0)
      fv.camRight.lookAt(0, 0, 0)
      fv.camRight.aspect = hw / hh
      fv.camRight.updateProjectionMatrix()
      refs.renderer.setViewport(0, 0, hw, hh)
      refs.renderer.setScissor(0, 0, hw, hh)
      refs.renderer.clear()
      refs.renderer.render(refs.scene, fv.camRight)
    }
    refs.camera.aspect = hw / hh
    refs.camera.updateProjectionMatrix()
    refs.renderer.setViewport(hw, 0, hw, hh)
    refs.renderer.setScissor(hw, 0, hw, hh)
    refs.renderer.clear()
    refs.renderer.render(refs.scene, refs.camera)
    refs.renderer.setScissorTest(false)
    refs.renderer.setViewport(origVP.x, origVP.y, origVP.z, origVP.w)
    refs.renderer.setClearColor(origClear)
  } else {
    const w = containerRef.value?.clientWidth || 500
    const h = Math.max(containerRef.value?.clientHeight || 450, 1)
    refs.camera.aspect = w / h
    refs.camera.updateProjectionMatrix()
    refs.renderer.render(refs.scene, refs.camera)
  }
  if (refs.labelRenderer) refs.labelRenderer.render(refs.scene, refs.camera)
  const now = performance.now()
  if (now - lastCameraEmit > 100 && refs.camera) {
    lastCameraEmit = now
    const p = refs.camera.position
    emit('camera-position', { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 })
  }
}

onMounted(() => {
  sceneApi.init()
  updateScene()
  animate()
  window.addEventListener('resize', sceneApi.onResize)
  const el = containerRef.value
  if (el) {
    el.addEventListener('pointermove', brickApi.onPointerMove)
    el.addEventListener('pointerleave', brickApi.onPointerLeave)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', sceneApi.onResize)
  const el = containerRef.value
  if (el) {
    el.removeEventListener('pointermove', brickApi.onPointerMove)
    el.removeEventListener('pointerleave', brickApi.onPointerLeave)
  }
  brickApi.cleanupBricks()
  sceneApi.dispose()
})

watch(
  () => [
    props.houseLength,
    props.houseWidth,
    props.brickWidth,
    props.brickLength,
    props.brickHeight,
    props.brickGap,
    props.edgeColor,
    props.gapColor,
    props.groundColor,
    props.labelSize,
    props.distributionBrickCount,
  ],
  () => updateScene(),
  { deep: true }
)
watch(
  () => props.showAllNumbers,
  (newVal) => brickApi.updateAllLabelsVisibility(newVal),
  { immediate: true }
)
watch(
  () => props.showBrickSides,
  () => brickApi.updateAllLabelsVisibility(props.showAllNumbers),
  { immediate: true }
)
watch(
  () => props.showBrickDimensions,
  () => brickApi.updateDimensionsArrows(),
  { immediate: true }
)
watch(
  () => props.showBrickDistances,
  (show) => {
    if (!show) {
      emit('brick-distances', [])
      return
    }
    const refs = sceneApi.getSceneRefs()
    if (refs.wallsGroup) {
      refs.wallsGroup.updateMatrixWorld(true)
      emit('brick-distances', brickApi.getBrickDistances())
    }
  },
  { immediate: true }
)

defineExpose({
  getBrickDistances: brickApi.getBrickDistances,
  setCameraViewX: sceneApi.setCameraViewX,
  setCameraViewY: sceneApi.setCameraViewY,
  setCameraViewZ: sceneApi.setCameraViewZ,
  resetCamera: sceneApi.resetCamera,
  setFourViewMode: sceneApi.setFourViewMode,
})
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

:deep(.brick-label.brick-label-side) {
  font-size: 0.85em;
  background: rgba(100, 150, 255, 0.9);
  color: #fff;
}

:deep(.dimension-label) {
  font-size: 10px;
  pointer-events: none;
}

:deep(.dimension-label-closure) {
  background: #ff0000;
  color: #fff;
}
</style>
