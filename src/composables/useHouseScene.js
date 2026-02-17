/**
 * useHouseScene — логика 3D-сцены: сцена, камера, рендерер, освещение, фундамент, управление камерой.
 * Не содержит логику кирпичей (см. useBrickWalls).
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

const DEFAULT_CAM_POS = { x: 20, y: 12, z: 20 }
const CAM_DIST = 25

export function useHouseScene(containerRef) {
  let scene, camera, renderer, labelRenderer, controls, wallsGroup, groundMesh
  let raycaster, mouse
  let camTop, camFront, camRight
  let fourViewMode = false
  let animationId = null

  function init() {
    if (!containerRef?.value) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a2332)

    const w = containerRef.value.clientWidth || 500
    const h = containerRef.value.clientHeight || 450
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
    camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    containerRef.value.appendChild(renderer.domElement)

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

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

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

    return { scene, camera, renderer, labelRenderer, controls, wallsGroup, raycaster, mouse }
  }

  /** Фундамент (плоскость) по размеру дома. */
  function addGround(options = {}) {
    const { houseLength = 10, houseWidth = 10, groundColor = '#4a5568' } = options
    if (groundMesh) {
      groundMesh.geometry.dispose()
      groundMesh.material.dispose()
      scene.remove(groundMesh)
    }

    const L = houseLength
    const W = houseWidth
    const geometry = new THREE.PlaneGeometry(L, W)
    const material = new THREE.MeshLambertMaterial({
      color: new THREE.Color(groundColor),
      side: THREE.DoubleSide,
    })
    groundMesh = new THREE.Mesh(geometry, material)
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    groundMesh.position.y = 0
    scene.add(groundMesh)
  }

  function onResize() {
    if (!containerRef?.value || !camera || !renderer) return
    const w = containerRef.value.clientWidth || 500
    const h = Math.max(containerRef.value.clientHeight, 450)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    if (labelRenderer) labelRenderer.setSize(w, h)
  }

  function setCameraViewX() {
    if (!camera || !controls) return
    camera.position.set(CAM_DIST, 0, 0)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  function setCameraViewY() {
    if (!camera || !controls) return
    camera.position.set(0, CAM_DIST, 0)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  function setCameraViewZ() {
    if (!camera || !controls) return
    camera.position.set(0, 0, CAM_DIST)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  function resetCamera() {
    if (!camera || !controls) return
    camera.position.set(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.y, DEFAULT_CAM_POS.z)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  function setFourViewMode(enabled) {
    fourViewMode = !!enabled
    if (fourViewMode && scene) {
      if (!camTop) camTop = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
      if (!camFront) camFront = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
      if (!camRight) camRight = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    }
  }

  function setAnimationId(id) {
    animationId = id
  }

  function getSceneRefs() {
    return {
      scene,
      camera,
      renderer,
      labelRenderer,
      controls,
      wallsGroup,
      raycaster,
      mouse,
      containerRef,
    }
  }

  function getFourViewRefs() {
    return {
      fourViewMode: () => fourViewMode,
      camTop,
      camFront,
      camRight,
      CAM_DIST,
    }
  }

  function dispose() {
    if (animationId) cancelAnimationFrame(animationId)
    if (containerRef?.value) {
      try {
        if (renderer?.domElement) containerRef.value.removeChild(renderer.domElement)
        if (labelRenderer?.domElement) containerRef.value.removeChild(labelRenderer.domElement)
      } catch (_) {}
    }
    renderer?.dispose()
    controls?.dispose()
    wallsGroup?.clear?.()
  }

  return {
    init,
    addGround,
    onResize,
    setCameraViewX,
    setCameraViewY,
    setCameraViewZ,
    resetCamera,
    setFourViewMode,
    setAnimationId,
    getSceneRefs,
    getFourViewRefs,
    get scene() { return scene },
    get camera() { return camera },
    get renderer() { return renderer },
    get labelRenderer() { return labelRenderer },
    get controls() { return controls },
    get wallsGroup() { return wallsGroup },
    get raycaster() { return raycaster },
    get mouse() { return mouse },
    dispose,
  }
}
