/**
 * usePathDrawing — рисование ломаной на плоскости (y=0), расстановка кирпичей вдоль пути.
 * Сцена: камера, плоскость для клика, точки, линии между точками, группа кирпичей.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const BRICK_COLOR = 0xc75c3d
const CLOSURE_BRICK_COLOR = 0xff0000
const POINT_COLOR = 0x00ff00
const LINE_COLOR = 0x00aaff
const GROUND_COLOR = 0x2d3748
const CAM_POS = { x: 15, y: 12, z: 15 }
const brickMargin = 0.97
const MIN_GAP_M = 0.001
const MAX_GAP_M = 0.003

export function usePathDrawing(containerRef) {
  let scene, camera, renderer, controls, raycaster, mouse
  let planeMesh, pointsGroup, lineGroup, bricksGroup
  let points = [] // массив THREE.Vector3 (x, 0, z)
  let pointMeshes = []
  let lineSegments = null
  let animationId = null
  let sharedBrickGeom = null
  let sharedBrickMat = null
  let sharedClosureMat = null
  let sharedEdgesGeom = null
  let sharedEdgeMat = null
  let sharedClosureEdgeMat = null
  let gapGeometries = []
  let closureGeometries = []
  let gapMaterial = null

  function init() {
    if (!containerRef?.value) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a2332)

    const w = containerRef.value.clientWidth || 500
    const h = containerRef.value.clientHeight || 450
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
    camera.position.set(CAM_POS.x, CAM_POS.y, CAM_POS.z)
    camera.lookAt(0, 0, 0)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    containerRef.value.appendChild(renderer.domElement)

    raycaster = new THREE.Raycaster()
    mouse = new THREE.Vector2()

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(15, 25, 15)
    dir.castShadow = true
    scene.add(dir)

    // Большая плоскость для кликов (y=0)
    const planeGeom = new THREE.PlaneGeometry(80, 80)
    const planeMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(GROUND_COLOR),
      side: THREE.DoubleSide,
    })
    planeMesh = new THREE.Mesh(planeGeom, planeMat)
    planeMesh.rotation.x = -Math.PI / 2
    planeMesh.position.y = 0
    planeMesh.name = 'drawPlane'
    scene.add(planeMesh)

    pointsGroup = new THREE.Group()
    scene.add(pointsGroup)

    lineGroup = new THREE.Group()
    scene.add(lineGroup)

    bricksGroup = new THREE.Group()
    scene.add(bricksGroup)

    return { scene, camera, renderer, controls, planeMesh, pointsGroup, lineGroup, bricksGroup }
  }

  /**
   * Преобразует событие мыши в NDC для raycaster.
   */
  function getMouseNDC(clientX, clientY) {
    const el = containerRef?.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
  }

  /**
   * Пересечение луча камеры с плоскостью y=0. Возвращает THREE.Vector3 или null.
   */
  function intersectPlane(clientX, clientY) {
    if (!camera || !planeMesh || !raycaster) return null
    getMouseNDC(clientX, clientY)
    raycaster.setFromCamera(mouse, camera)
    const hits = raycaster.intersectObject(planeMesh)
    if (hits.length) {
      const p = hits[0].point.clone()
      p.y = 0
      return p
    }
    return null
  }

  /**
   * Добавить точку на плоскости (мировые координаты).
   */
  function addPoint(worldPos) {
    const p = worldPos.clone()
    p.y = 0
    points.push(p)

    const sphereGeom = new THREE.SphereGeometry(0.15, 16, 16)
    const sphereMat = new THREE.MeshLambertMaterial({ color: POINT_COLOR })
    const mesh = new THREE.Mesh(sphereGeom, sphereMat)
    mesh.position.copy(p)
    mesh.castShadow = true
    pointsGroup.add(mesh)
    pointMeshes.push({ mesh, geom: sphereGeom })

    updateLineGeometry()
    return p
  }

  function updateLineGeometry() {
    if (lineSegments?.geometry) lineSegments.geometry.dispose()
    lineGroup.clear()

    if (points.length < 2) return

    const positions = []
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geom.computeBoundingSphere()
    const mat = new THREE.LineBasicMaterial({ color: LINE_COLOR, linewidth: 2 })
    lineSegments = new THREE.LineSegments(geom, mat)
    lineGroup.add(lineSegments)
  }

  function getPoints() {
    return points.map((p) => p.clone())
  }

  function clearPoints() {
    points = []
    pointMeshes.forEach(({ geom }) => geom.dispose())
    pointMeshes = []
    pointsGroup.clear()
    lineGroup.clear()
    if (lineSegments?.geometry) {
      lineSegments.geometry.dispose()
      lineSegments = null
    }
  }

  /**
   * Длина пути по ломаной (сумма длин отрезков).
   */
  function getPathLength() {
    let len = 0
    for (let i = 0; i < points.length - 1; i++) {
      len += points[i].distanceTo(points[i + 1])
    }
    return len
  }

  /**
   * Позиция и касательная на пути на расстоянии s от начала (0..pathLength).
   * Возвращает { position: Vector3, tangent: Vector3 } или null.
   */
  function getPositionAtPathLength(s) {
    if (points.length < 2) return null
    let acc = 0
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      const segLen = a.distanceTo(b)
      if (acc + segLen >= s - 1e-9) {
        const t = segLen > 1e-9 ? (s - acc) / segLen : 0
        const position = new THREE.Vector3().lerpVectors(a, b, t)
        position.y = 0
        const tangent = new THREE.Vector3().subVectors(b, a).normalize()
        return { position, tangent }
      }
      acc += segLen
    }
    const last = points[points.length - 1]
    const prev = points[points.length - 2]
    const tangent = new THREE.Vector3().subVectors(last, prev).normalize()
    return { position: last.clone(), tangent }
  }

  /**
   * Случайный зазор E в диапазоне 1–3 мм (как в useBrickWalls).
   */
  function randomGapM() {
    return MIN_GAP_M + Math.random() * (MAX_GAP_M - MIN_GAP_M)
  }

  /**
   * Поставить один меш (кирпич N, замыкающий Z или зазор E) на пути.
   * centerS — координата по длине пути (от начала) для центра элемента.
   * lenAlong — длина элемента вдоль пути (м).
   */
  function placeSegment(centerS, lenAlong, type, brickNumber, brickLengthM, brickWidthM, brickHeightM, pathLen) {
    const data = getPositionAtPathLength(Math.min(Math.max(0, centerS), pathLen - 1e-6))
    if (!data) return
    const { position, tangent } = data
    // В Three.js при rotation.y локальная ось +X переходит в (cos(angle), 0, sin(angle)); нужен (tangent.x, 0, tangent.z) => angle = atan2(tangent.z, tangent.x)
    const angle = Math.atan2(tangent.z, tangent.x)
    const y = brickHeightM / 2
    const EPS = 1e-9

    if (type === 'E') {
      const gapLen = Math.max(MIN_GAP_M, Math.min(MAX_GAP_M, lenAlong))
      const geom = new THREE.BoxGeometry(gapLen, brickHeightM, brickWidthM)
      gapGeometries.push(geom)
      const mesh = new THREE.Mesh(geom, gapMaterial)
      mesh.position.copy(position)
      mesh.position.y = y
      mesh.rotation.y = angle
      mesh.castShadow = true
      bricksGroup.add(mesh)
      return
    }

    const isClosure = type === 'Z'
    let geom
    let edgesGeom
    if (isClosure) {
      geom = new THREE.BoxGeometry(lenAlong, brickHeightM, brickWidthM)
      closureGeometries.push(geom)
      edgesGeom = new THREE.EdgesGeometry(geom)
      closureGeometries.push(edgesGeom)
    } else {
      geom = sharedBrickGeom
      edgesGeom = sharedEdgesGeom
    }
    const mat = isClosure ? sharedClosureMat : sharedBrickMat
    const lineMat = isClosure ? sharedClosureEdgeMat : sharedEdgeMat

    const mesh = new THREE.Mesh(geom, mat)
    mesh.scale.set(1, brickMargin, brickMargin)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.add(new THREE.LineSegments(edgesGeom, lineMat))
    mesh.position.copy(position)
    mesh.position.y = y
    mesh.rotation.y = angle
    mesh.userData.number = brickNumber
    mesh.userData.isClosure = isClosure
    mesh.userData.closureLengthMm = isClosure ? Math.round(lenAlong * 1000) : null
    bricksGroup.add(mesh)
  }

  /**
   * Расставить кирпичи вдоль пути по правилу E → N → E → N (как в useBrickWalls).
   * Сначала зазор E (1–3 мм), затем кирпич N; последний кирпич может быть замыкающим Z, если пути не хватает.
   * Размеры в метрах. gapColorHex — цвет зазора, например 0x888888.
   */
  function placeBricksAlongPath(count, brickLengthM, brickWidthM, brickHeightM, gapM = 0.002, gapColorHex = 0x888888) {
    gapGeometries.forEach((g) => g.dispose())
    gapGeometries = []
    closureGeometries.forEach((g) => g.dispose())
    closureGeometries = []
    if (gapMaterial) gapMaterial.dispose()
    if (sharedEdgeMat) sharedEdgeMat.dispose()
    if (sharedClosureEdgeMat) sharedClosureEdgeMat.dispose()
    if (sharedEdgesGeom) sharedEdgesGeom.dispose()
    if (sharedBrickGeom) sharedBrickGeom.dispose()
    if (sharedBrickMat) sharedBrickMat.dispose()
    if (sharedClosureMat) sharedClosureMat?.dispose?.()
    bricksGroup.clear()

    if (points.length < 2 || count < 1) return

    const pathLen = getPathLength()
    if (pathLen < 1e-6) return

    const x = brickLengthM
    const EPS = 1e-9
    gapMaterial = new THREE.MeshLambertMaterial({ color: gapColorHex, flatShading: true })
    sharedBrickGeom = new THREE.BoxGeometry(brickLengthM, brickHeightM, brickWidthM)
    sharedBrickMat = new THREE.MeshLambertMaterial({ color: BRICK_COLOR, flatShading: true })
    sharedClosureMat = new THREE.MeshLambertMaterial({ color: CLOSURE_BRICK_COLOR, flatShading: true })
    sharedEdgesGeom = new THREE.EdgesGeometry(sharedBrickGeom)
    sharedEdgeMat = new THREE.LineBasicMaterial({ color: 0x333333 })
    sharedClosureEdgeMat = new THREE.LineBasicMaterial({ color: 0x660000 })

    let pos = 0
    let brickNumber = 1

    for (let i = 0; i < count; i++) {
      const gapE = randomGapM()
      if (pos + gapE > pathLen + EPS) break
      placeSegment(pos + gapE / 2, gapE, 'E', null, brickLengthM, brickWidthM, brickHeightM, pathLen)
      pos += gapE

      const remaining = pathLen - pos
      const isLast = i === count - 1
      let brickLen = x
      if (remaining < x - EPS) {
        brickLen = Math.max(EPS, remaining)
      }
      if (brickLen < EPS) break

      const isClosure = brickLen < x - EPS
      placeSegment(pos + brickLen / 2, brickLen, isClosure ? 'Z' : 'N', brickNumber++, brickLengthM, brickWidthM, brickHeightM, pathLen)
      pos += brickLen
    }
  }

  function onResize() {
    if (!containerRef?.value || !camera || !renderer) return
    const w = containerRef.value.clientWidth || 500
    const h = Math.max(containerRef.value.clientHeight, 450)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  function animate() {
    animationId = requestAnimationFrame(animate)
    controls?.update?.()
    renderer?.render(scene, camera)
  }

  function dispose() {
    if (animationId != null) cancelAnimationFrame(animationId)
    clearPoints()
    planeMesh?.geometry?.dispose?.()
    planeMesh?.material?.dispose?.()
    sharedEdgeMat?.dispose?.()
    sharedClosureEdgeMat?.dispose?.()
    sharedEdgesGeom?.dispose?.()
    sharedBrickGeom?.dispose?.()
    sharedBrickMat?.dispose?.()
    sharedClosureMat?.dispose?.()
    gapGeometries.forEach((g) => g.dispose())
    closureGeometries.forEach((g) => g.dispose())
    bricksGroup?.clear?.()
    lineSegments?.geometry?.dispose?.()
    renderer?.dispose?.()
    if (containerRef?.value && renderer?.domElement) {
      containerRef.value.removeChild(renderer.domElement)
    }
  }

  return {
    init,
    intersectPlane,
    addPoint,
    getPoints,
    clearPoints,
    getPathLength,
    placeBricksAlongPath,
    onResize,
    animate,
    dispose,
  }
}
