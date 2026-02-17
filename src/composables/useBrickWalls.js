/**
 * useBrickWalls — логика кирпичей: построение стен, расстояния, подписи, стрелки размеров, hover.
 * Работает с wallsGroup и прочими refs сцены (получает через getSceneRefs).
 */
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

const WALL_DIRECTIONS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 0, -1),
]

const brickColor = 0xc75c3d
const brickMargin = 0.97
const closureBrickColor = 0xff0000
const MAX_DISPLAY_ROWS = 25
const MAX_BRICKS_PER_WALL = 80

const ARROW_COLOR = 0xffff00
const LABEL_BG = '#e67e22'
const LABEL_TEXT = '#000000'

export function useBrickWalls(props, emit, getSceneRefs) {
  let lastBrickGeometry, lastBrickMaterial, lastEdgesGeometry, lastLineMaterial
  let closureBrickMaterial, closureBrickLineMaterial
  let closureGeometries = []
  let hoveredBrickMesh = null
  let stripeOverlayMesh = null

  function refs() {
    return getSceneRefs() || {}
  }

  function cleanupLabelElements(obj) {
    obj.traverse((child) => {
      if (child.isCSS2DObject && child.element?.parentNode) {
        child.element.parentNode.removeChild(child.element)
      }
    })
  }

  function getBrickDistances() {
    const { wallsGroup } = refs()
    if (!wallsGroup) return []
    const meshes = []
    wallsGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData?.number != null && obj.userData?.wallIndex != null) {
        meshes.push(obj)
      }
    })
    meshes.sort((a, b) => (a.userData.number ?? 0) - (b.userData.number ?? 0))
    const WALL_DIRS = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]
    const results = []
    for (let i = 0; i < meshes.length - 1; i++) {
      const m1 = meshes[i]
      const m2 = meshes[i + 1]
      const n1 = m1.userData.number
      const n2 = m2.userData.number
      const box1 = new THREE.Box3().setFromObject(m1)
      const box2 = new THREE.Box3().setFromObject(m2)
      const center1 = new THREE.Vector3()
      const center2 = new THREE.Vector3()
      box1.getCenter(center1)
      box2.getCenter(center2)
      const v = center2.clone().sub(center1)
      const w1 = m1.userData.wallIndex ?? 0
      const w2 = m2.userData.wallIndex ?? 0
      const dir = WALL_DIRS[w1]
      const proj = v.dot(dir)
      const size1 = box1.getSize(new THREE.Vector3())
      const size2 = box2.getSize(new THREE.Vector3())
      const half1 = (w1 === 0 || w1 === 2 ? size1.x : size1.z) / 2
      const half2 = (w2 === 0 || w2 === 2 ? size2.x : size2.z) / 2
      const gap = Math.abs(proj) - half1 - half2
      const gapMm = Math.round(gap * 1000)
      results.push({
        from: n1,
        to: n2,
        gapMm: gapMm,
        overlapMm: gap < 0 ? Math.abs(gapMm) : undefined,
      })
    }
    return results
  }

  function fixIntersections(brickL, margin = brickMargin) {
    const { wallsGroup } = refs()
    if (!wallsGroup) return
    const meshes = []
    wallsGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData?.number != null && obj.userData?.wallIndex != null) {
        meshes.push(obj)
      }
    })
    const boxA = new THREE.Box3()
    const boxB = new THREE.Box3()
    const halfLength = (brickL * margin) / 2
    let fixed
    for (let iter = 0; iter < 10; iter++) {
      wallsGroup.updateMatrixWorld(true)
      fixed = false
      for (let i = 0; i < meshes.length; i++) {
        for (let j = i + 1; j < meshes.length; j++) {
          boxA.setFromObject(meshes[i])
          boxB.setFromObject(meshes[j])
          if (!boxA.intersectsBox(boxB)) continue
          const ni = meshes[i].userData.number
          const nj = meshes[j].userData.number
          const closureA = !!meshes[i].userData?.isClosure
          const closureB = !!meshes[j].userData?.isClosure
          if (Math.abs(ni - nj) === 1 && (closureA || closureB)) continue
          const [toShift] = ni > nj ? [meshes[i], meshes[j]] : [meshes[j], meshes[i]]
          const dir = WALL_DIRECTIONS[toShift.userData.wallIndex].clone()
          toShift.position.add(dir.multiplyScalar(halfLength))
          fixed = true
        }
      }
      if (!fixed) break
    }
  }

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
    const { wallsGroup } = refs()
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

  function updateLabelVisibility(mesh, showAll, isHovered) {
    const { labelEl, labelObj } = mesh.userData || {}
    if (!labelEl || !labelObj) return
    const show = showAll || isHovered
    labelObj.visible = show
    labelEl.classList.toggle('brick-label-hover', isHovered)
  }

  function updateAllLabelsVisibility(showAll) {
    const { wallsGroup } = refs()
    const val = showAll ?? props.showAllNumbers
    wallsGroup?.traverse((obj) => {
      if (obj.isMesh && obj.userData?.labelEl) {
        updateLabelVisibility(obj, val, obj === hoveredBrickMesh)
      }
    })
  }

  function buildBrickHoverData(mesh, distances) {
    if (!mesh?.userData) return null
    const n = mesh.userData.number
    const isClosure = !!mesh.userData.isClosure
    const closureMm = mesh.userData.closureLengthMm
    const brickW = props.brickWidth
    const brickL = props.brickLength
    const brickH = props.brickHeight
    const dims = closureMm != null
      ? `${brickW}×${brickH}×${closureMm} мм`
      : `${brickW}×${brickL}×${brickH} мм`
    const distToPrev = distances?.find((d) => d.to === n) ?? null
    const distToNext = distances?.find((d) => d.from === n) ?? null
    return {
      number: n,
      dimensions: dims,
      isClosure,
      distToPrev,
      distToNext,
    }
  }

  function createStripeOverlay(geometry) {
    const uniforms = { time: { value: 0 } }
    const mat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        void main() {
          float stripe = mod(vUv.x * 12.0 + time * 4.0, 1.0);
          float a = stripe < 0.5 ? 0.35 : 0.2;
          vec3 col = stripe < 0.5 ? vec3(0,0,0) : vec3(1,1,1);
          gl_FragColor = vec4(col, a);
        }
      `,
    })
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.renderOrder = 1
    mesh.userData.stripeUniforms = uniforms
    return mesh
  }

  function removeStripeOverlay() {
    if (stripeOverlayMesh?.parent) {
      stripeOverlayMesh.parent.remove(stripeOverlayMesh)
      stripeOverlayMesh.geometry?.dispose?.()
      stripeOverlayMesh.material?.dispose?.()
    }
    stripeOverlayMesh = null
  }

  function getStripeOverlay() {
    return stripeOverlayMesh
  }

  function buildDistributionWalls(L, W, brickW, brickL, brickH, gapM) {
    const { wallsGroup } = refs()
    if (!wallsGroup) return

    const halfW = brickW / 2
    const halfL = brickL / 2
    const baseFontSize = 10 * (props.labelSize || 1)
    const n = Math.max(1, Math.floor(props.distributionBrickCount))
    const brickAlongPath = Math.max(brickW, brickL)
    const halfBrickAlongPath = brickAlongPath / 2
    const halfExtent = brickAlongPath * brickMargin / 2
    const step = brickAlongPath * brickMargin + gapM
    const closureGapM = Math.min(Math.max(gapM, 0.001), 0.003)

    const segs = [
      { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: -L + halfL + t * (2 * L - brickL), z: -W, wallIndex: 0, rotate90: true }) },
      { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: L, z: -W + halfW + t * (2 * W - brickW), wallIndex: 1, rotate90: false }) },
      { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: L - halfL - t * (2 * L - brickL), z: W, wallIndex: 2, rotate90: true }) },
      { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: -L, z: W - halfW - t * (2 * W - brickW), wallIndex: 3, rotate90: false }) },
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

    function getSegmentIndex(dist) {
      const d = perimeter > 1e-6 ? dist % perimeter : 0
      for (let s = 0; s < segEnds.length; s++) {
        if (d < segEnds[s]) return s
      }
      return segEnds.length - 1
    }

    function getCornerDist(dist) {
      const s = getSegmentIndex(dist)
      const ext = (s === 0 || s === 2) ? halfL : halfW
      return segEnds[s] + ext
    }

    function getPrevSegmentCornerDist(segIndex) {
      if (segIndex <= 0) return 0
      const ext = (segIndex === 1 || segIndex === 3) ? halfL : halfW
      return segEnds[segIndex - 1] + ext
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
      let dist = (offsetForRow + posInLap * step) % (perimeter || 1)
      const y = row * (brickH + closureGapM) + brickH / 2

      const segmentEnd = getSegmentEnd(dist)
      const segIndex = getSegmentIndex(dist)
      const cornerDist = getCornerDist(dist)

      if (segIndex > 0) {
        const posInLapPrev = posInLap === 0 ? bricksPerLap - 1 : posInLap - 1
        const distPrev = (offsetForRow + posInLapPrev * step) % (perimeter || 1)
        if (distPrev < segEnds[segIndex - 1]) {
          const cornerDistPrev = getPrevSegmentCornerDist(segIndex)
          const distFromEdgePrev = cornerDistPrev - (distPrev + halfExtent)
          const prevWasClosure = distFromEdgePrev > 1e-6 && distFromEdgePrev < brickAlongPath
          const halfExtentCurrent = (segIndex === 0 || segIndex === 2) ? halfL * brickMargin : halfW * brickMargin
          if (prevWasClosure && dist - halfExtentCurrent < cornerDistPrev) {
            dist = cornerDistPrev + halfExtentCurrent + closureGapM
          }
        }
      }
      const halfExtentSeg = (segIndex === 0 || segIndex === 2) ? halfL * brickMargin : halfW * brickMargin
      const distFromEdgeToCorner = cornerDist - (dist + halfExtentSeg)
      const brickExtentSeg = (segIndex === 0 || segIndex === 2) ? brickL : brickW
      const needClosure = distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < brickExtentSeg
      const closureLenM = needClosure ? Math.min(cornerDist - (dist - halfExtentSeg), 2 * brickAlongPath) : null
      const closureLen = closureLenM != null ? closureLenM / brickMargin : null
      const posDist = needClosure ? (dist - halfExtentSeg + cornerDist) / 2 : dist
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
      const halfExtX = (pt.wallIndex === 1 || pt.wallIndex === 3) ? halfW * brickMargin : 0
      const halfExtZ = (pt.wallIndex === 0 || pt.wallIndex === 2) ? halfW * brickMargin : 0
      const dx = (pt.wallIndex === 1 ? -halfExtX : pt.wallIndex === 3 ? halfExtX : 0)
      const dz = (pt.wallIndex === 0 ? halfExtZ : pt.wallIndex === 2 ? -halfExtZ : 0)
      mesh.position.set(pt.x + dx, y, pt.z + dz)
      wallsGroup.add(mesh)
    }

    hoveredBrickMesh = null
  }

  function buildWalls() {
    const { wallsGroup } = refs()
    if (!wallsGroup) return

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

    const L = props.houseLength / 2
    const W = props.houseWidth / 2
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

    const halfL = brickL / 2
    const halfW = brickW / 2
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
    const stepAlong = extentAlongWall + gapM
    const extentBrick = (w) => (w.rotate90 ? brickL : brickW)

    for (let row = 0; row < rowsCount; row++) {
      const y = row * (brickH + gapM) + brickH / 2
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
          const cornerExt = wall.rotate90 ? halfL : halfW
          const cornerLen = wall.segmentLen + cornerExt
          const distFromEdgeToCorner = cornerLen - lastFarEdge
          const needClosure = isLastOnWall && distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < X
          const closureLenM = needClosure ? Math.min(cornerLen - lastCenterAlong + halfX, 2 * X) : null
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
          mesh.add(new THREE.LineSegments(edgesGeom, lineMat))

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
      mesh.position.set(-L + halfL, brickH / 2, -W + halfW)
      mesh.castShadow = true
      wallsGroup.add(mesh)
    }
  }

  function onPointerMove(event) {
    const { wallsGroup, raycaster, mouse, camera, containerRef } = refs()
    if (!containerRef?.value || !camera || !wallsGroup) return
    const rect = containerRef.value.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(wallsGroup.children, true)
    let hitObj = intersects[0]?.object
    while (hitObj && hitObj.userData?.number == null) hitObj = hitObj.parent
    const hit = hitObj?.userData?.number != null ? hitObj : null
    if (hit !== hoveredBrickMesh) {
      if (hoveredBrickMesh?.userData?.labelEl) {
        updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
      }
      removeStripeOverlay()
      hoveredBrickMesh = hit || null
      if (hoveredBrickMesh?.userData?.labelEl) {
        updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, true)
      }
      if (hoveredBrickMesh?.geometry) {
        const geo = hoveredBrickMesh.geometry.clone()
        stripeOverlayMesh = createStripeOverlay(geo)
        hoveredBrickMesh.add(stripeOverlayMesh)
      }
      wallsGroup.updateMatrixWorld(true)
      const distances = getBrickDistances()
      const data = hoveredBrickMesh ? buildBrickHoverData(hoveredBrickMesh, distances) : null
      emit('brick-hover', { data, pointerX: event.clientX, pointerY: event.clientY })
    } else if (hoveredBrickMesh) {
      const distances = getBrickDistances()
      const data = buildBrickHoverData(hoveredBrickMesh, distances)
      emit('brick-hover', { data, pointerX: event.clientX, pointerY: event.clientY })
    }
  }

  function onPointerLeave() {
    if (hoveredBrickMesh?.userData?.labelEl) {
      updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
    }
    removeStripeOverlay()
    hoveredBrickMesh = null
    emit('brick-hover', { data: null, pointerX: 0, pointerY: 0 })
  }

  function cleanupBricks() {
    const { wallsGroup } = refs()
    removeStripeOverlay()
    hoveredBrickMesh = null
    wallsGroup?.traverse?.((obj) => {
      if (obj.isCSS2DObject && obj.element?.parentNode) {
        obj.element.parentNode.removeChild(obj.element)
      }
    })
    wallsGroup?.clear?.()
  }

  return {
    buildWalls,
    getBrickDistances,
    updateDimensionsArrows,
    updateAllLabelsVisibility,
    onPointerMove,
    onPointerLeave,
    getStripeOverlay,
    cleanupBricks,
  }
}
