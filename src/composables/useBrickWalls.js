/**
 * useBrickWalls — логика кирпичей: построение стен, расстояния, подписи, стрелки размеров, hover.
 * Работает с wallsGroup и прочими refs сцены (получает через getSceneRefs).
 */
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

// ========== КОНСТАНТЫ ==========
const brickColor = 0xc75c3d                        // Цвет обычного кирпича (оранжево-красный)
const brickMargin = 0.97                           // Масштаб меша для визуального зазора ~3% между кирпичами
const closureBrickColor = 0xff0000                 // Цвет замыкающего (обрезанного) кирпича (красный)
const closureToZ1Color = 0x9acd32                 // Цвет замыкающего до z1 (жёлто-зелёный)

const ARROW_COLOR = 0xffff00                       // Цвет стрелок размеров (жёлтый)
const LABEL_BG = '#e67e22'                        // Фон подписи размеров
const LABEL_TEXT = '#000000'                      // Текст подписи размеров

export function useBrickWalls(props, emit, getSceneRefs) {
  // ========== ВНУТРЕННИЕ ПЕРЕМЕННЫЕ ==========
  // Общие геометрия и материалы для всех обычных кирпичей (экономия памяти)
  let lastBrickGeometry, lastBrickMaterial, lastEdgesGeometry, lastLineMaterial
  // Материалы для замыкающих кирпичей (красные) и замыкающего до z1 (жёлто-зелёный)
  let closureBrickMaterial, closureBrickLineMaterial, closureToZ1Material, closureToZ1LineMaterial
  // Материал и геометрии для зазоров E (цвет из props.gapColor)
  let gapMaterial
  let gapGeometries = []
  // Геометрии замыкающих кирпичей (для последующего dispose)
  let closureGeometries = []
  // Текущий кирпич под курсором мыши
  let hoveredBrickMesh = null
  // Полосатый оверлей на hover-кирпиче
  let stripeOverlayMesh = null

  /**
   * Получает актуальные ссылки на объекты сцены (wallsGroup, camera, raycaster и т.д.)
   * @returns {Object} Объект с refs сцены
   */
  function refs() {
    return getSceneRefs() || {}
  }

  /**
   * Удаляет DOM-элементы подписей из объекта (для очистки перед пересборкой).
   * Рекурсивно проходит по всем дочерним объектам и удаляет CSS2DObject элементы.
   * @param {THREE.Object3D} obj - Объект для очистки
   */
  function cleanupLabelElements(obj) {
    obj.traverse((child) => {
      if (child.isCSS2DObject && child.element?.parentNode) {
        child.element.parentNode.removeChild(child.element)
      }
    })
  }

  /**
   * Вычисляет расстояния между соседними кирпичами (зазоры в мм).
   * Собирает все меши кирпичей, сортирует по номеру, затем для каждой пары соседних
   * вычисляет расстояние между их центрами вдоль стены и вычитает половины размеров.
   * @returns {Array<{from: number, to: number, gapMm: number, overlapMm?: number}>}
   *   Массив объектов с расстояниями между кирпичами. Если gap < 0, добавляется overlapMm.
   */
  function getBrickDistances() {
    const { wallsGroup } = refs()
    if (!wallsGroup) return []
    
    // Собираем все меши кирпичей
    const meshes = []
    wallsGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData?.number != null && obj.userData?.wallIndex != null) {
        meshes.push(obj)
      }
    })
    
    // Сортируем по номеру кирпича
    meshes.sort((a, b) => (a.userData.number ?? 0) - (b.userData.number ?? 0))
    
    // Направления стен для проекции вектора между центрами
    const WALL_DIRS = [
      new THREE.Vector3(1, 0, 0),   // Стена 0: вдоль +X
      new THREE.Vector3(0, 0, 1),   // Стена 1: вдоль +Z
      new THREE.Vector3(-1, 0, 0),  // Стена 2: вдоль -X
      new THREE.Vector3(0, 0, -1),  // Стена 3: вдоль -Z
    ]
    
    const results = []
    // Для каждой пары соседних кирпичей вычисляем зазор
    for (let i = 0; i < meshes.length - 1; i++) {
      const m1 = meshes[i]
      const m2 = meshes[i + 1]
      const n1 = m1.userData.number
      const n2 = m2.userData.number
      
      // Получаем bounding boxes для вычисления размеров
      const box1 = new THREE.Box3().setFromObject(m1)
      const box2 = new THREE.Box3().setFromObject(m2)
      const center1 = new THREE.Vector3()
      const center2 = new THREE.Vector3()
      box1.getCenter(center1)
      box2.getCenter(center2)
      
      // Вектор от центра первого к центру второго
      const v = center2.clone().sub(center1)
      const w1 = m1.userData.wallIndex ?? 0
      const w2 = m2.userData.wallIndex ?? 0
      
      // Проекция вектора на направление стены первого кирпича
      const dir = WALL_DIRS[w1]
      const proj = v.dot(dir)
      
      // Получаем размеры кирпичей вдоль стены
      const size1 = box1.getSize(new THREE.Vector3())
      const size2 = box2.getSize(new THREE.Vector3())
      const half1 = (w1 === 0 || w1 === 2 ? size1.x : size1.z) / 2
      const half2 = (w2 === 0 || w2 === 2 ? size2.x : size2.z) / 2
      
      // Зазор = расстояние между центрами - половины размеров
      const gap = Math.abs(proj) - half1 - half2
      const gapMm = Math.round(gap * 1000)
      
      results.push({
        from: n1,
        to: n2,
        gapMm: gapMm,
        overlapMm: gap < 0 ? Math.abs(gapMm) : undefined,  // Если отрицательный — пересечение
      })
    }
    return results
  }

  /**
   * Логирует в консоль расстояния (зазоры) между ВСЕМИ соседними кирпичами.
   *
   * Пример вывода для 4 кирпичей:
   *   расстояние от 1 до 2 = 2 мм
   *   расстояние от 2 до 3 = 1 мм
   *   расстояние от 3 до 4 = 3 мм
   *
   * Это удобно, чтобы глазами проверить последовательность N1‑E1‑N2‑E2‑Z1‑E3‑N3...
   *
   * @returns {Array<{from:number,to:number,gapMm:number,overlapMm?:number}>}
   */
  function logBrickDistances() {
    const { wallsGroup } = refs()
    wallsGroup?.updateMatrixWorld?.(true)
    const distances = getBrickDistances()

    // eslint-disable-next-line no-console
    console.group?.('[bricks] расстояния между кирпичами')
    distances.forEach((d) => {
      const overlapPart = d.overlapMm != null
        ? ` (ПЕРЕСЕЧЕНИЕ ${d.overlapMm} мм)`
        : ''
      // eslint-disable-next-line no-console
      console.log(`расстояние от ${d.from} до ${d.to} = ${d.gapMm} мм${overlapPart}`)
    })
    // eslint-disable-next-line no-console
    if (distances.length === 0) console.log('кирпичей меньше двух — расстояния не считаются')
    console.groupEnd?.()

    return distances
  }

  /**
   * Добавляет стрелки размеров (X, Y, Z) к кирпичу с подписями.
   * Создаёт три ArrowHelper (по осям X, Y, Z) и CSS2DObject подписи с размерами.
   * Для замыкающих кирпичей использует красный цвет и реальную длину вместо стандартной.
   * @param {THREE.Mesh} mesh - Меш кирпича
   * @param {number} brickW - Ширина кирпича (м)
   * @param {number} brickH - Высота кирпича (м)
   * @param {number} brickL - Длина кирпича (м)
   * @param {Object} opts - Опции: {isClosure, isClosureToZ1, closureLengthMm, closureAxis}
   */
  function addDimensionArrowsToBrick(mesh, brickW, brickH, brickL, opts = {}) {
    const { isClosure = false, isClosureToZ1 = false, closureLengthMm = null, closureAxis = 'z' } = opts
    const closureLen = closureLengthMm != null ? closureLengthMm / 1000 : null
    const dimZ = closureLen != null && closureAxis === 'z' ? closureLen : brickL
    
    // Начальная точка для стрелок (нижний левый угол кирпича)
    const vertex = new THREE.Vector3(-brickW / 2, -brickH / 2, -dimZ / 2)
    
    // Цвета и стили в зависимости от типа кирпича (Z_TO_Z1 — жёлто-зелёный)
    const arrowColor = isClosureToZ1 ? 0x9acd32 : (isClosure ? 0xff0000 : ARROW_COLOR)
    const labelBg = isClosureToZ1 ? '#9acd32' : (isClosure ? '#ff0000' : LABEL_BG)
    const labelText = (isClosureToZ1 || isClosure) ? '#ffffff' : LABEL_TEXT
    
    // Три оси: X = вдоль ряда (UI «Длина»), Y = высота, Z = толщина (UI «Ширина (ряд)»)
    const axes = [
      { axis: 'x', dir: new THREE.Vector3(1, 0, 0), len: brickW, label: props.brickLength },
      { axis: 'y', dir: new THREE.Vector3(0, 1, 0), len: brickH, label: props.brickHeight },
      { axis: 'z', dir: new THREE.Vector3(0, 0, 1), len: brickL, label: props.brickWidth },
    ]
    
    axes.forEach(({ axis, dir, len, label }) => {
      // Для замыкающего кирпича используем реальную длину по оси closureAxis
      const useLen = closureLen != null && axis === closureAxis ? closureLen : len
      const useLabel = closureLen != null && axis === closureAxis ? Math.round(closureLengthMm) : label
      
      // Создаём стрелку
      const arrow = new THREE.ArrowHelper(dir, vertex, useLen, arrowColor)
      arrow.userData.isDimensionArrow = true
      mesh.add(arrow)
      
      // Позиция подписи — середина стрелки
      const mid = vertex.clone().add(dir.clone().multiplyScalar(useLen / 2))
      const div = document.createElement('div')
      div.className = isClosureToZ1 ? 'dimension-label dimension-label-closure-to-z1' : (isClosure ? 'dimension-label dimension-label-closure' : 'dimension-label')
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

  /**
   * Удаляет все стрелки размеров и их подписи из кирпича.
   * Находит все объекты с userData.isDimensionArrow и удаляет их.
   * @param {THREE.Mesh} mesh - Меш кирпича
   */
  function removeDimensionArrowsFromBrick(mesh) {
    const toRemove = []
    mesh.traverse((child) => {
      if (child.userData?.isDimensionArrow) toRemove.push(child)
    })
    toRemove.forEach((obj) => {
      mesh.remove(obj)
      // Удаляем DOM-элемент из документа
      if (obj.isCSS2DObject && obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element)
    })
  }

  /**
   * Обновляет стрелки размеров для всех кирпичей в сцене.
   * Если props.showBrickDimensions === true, добавляет стрелки, иначе удаляет.
   * Для замыкающих кирпичей использует их реальную длину.
   */
  function updateDimensionsArrows() {
    const { wallsGroup } = refs()
    if (!wallsGroup) return
    
    wallsGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData?.number != null) {
        // Сначала удаляем старые стрелки
        removeDimensionArrowsFromBrick(obj)
        
        // Если включено отображение размеров — добавляем новые
        if (props.showBrickDimensions) {
          const brickW = props.brickWidth / 1000
          const brickH = props.brickHeight / 1000
          const brickL = props.brickLength / 1000
          
          // Для замыкающих кирпичей передаём их реальную длину
          const opts = obj.userData?.isClosure && obj.userData?.closureLengthMm != null
            ? {
                isClosure: true,
                isClosureToZ1: !!obj.userData?.isClosureToZ1,
                closureLengthMm: obj.userData.closureLengthMm,
                closureAxis: 'z',
              }
            : {}
          
          addDimensionArrowsToBrick(obj, brickW, brickH, brickL, opts)
        }
      }
    })
  }

  /**
   * Обновляет видимость подписи-номера одного кирпича.
   * Подпись видна, если showAll === true или isHovered === true.
   * @param {THREE.Mesh} mesh - Меш кирпича
   * @param {boolean} showAll - Показывать все подписи
   * @param {boolean} isHovered - Кирпич под курсором
   */
  function updateLabelVisibility(mesh, showAll, isHovered) {
    const ud = mesh.userData || {}
    const { labelEl, labelObj, sideLabels } = ud
    const show = showAll || isHovered
    if (labelEl && labelObj) {
      labelObj.visible = show
      labelEl.classList.toggle('brick-label-hover', isHovered)
    }
    const showSides = props.showBrickSides || isHovered
    if (sideLabels && Array.isArray(sideLabels)) {
      sideLabels.forEach(({ obj }) => { obj.visible = showSides })
    }
  }

  /**
   * Обновляет видимость подписей для всех кирпичей в сцене.
   * Проходит по всем мешам и вызывает updateLabelVisibility для каждого.
   * @param {boolean} showAll - Показывать все подписи (если null, берётся из props.showAllNumbers)
   */
  function updateAllLabelsVisibility(showAll) {
    const { wallsGroup } = refs()
    const val = showAll ?? props.showAllNumbers
    
    wallsGroup?.traverse((obj) => {
      if (obj.isMesh && obj.userData?.labelEl) {
        updateLabelVisibility(obj, val, obj === hoveredBrickMesh)
      }
    })
  }

  /**
   * Собирает данные о кирпиче для отображения в UXUI панели при наведении.
   * Формирует строку размеров, находит расстояния до соседних кирпичей.
   * @param {THREE.Mesh} mesh - Меш кирпича
   * @param {Array} distances - Массив расстояний между кирпичами (из getBrickDistances)
   * @returns {Object|null} Объект с данными кирпича или null
   */
  function buildBrickHoverData(mesh, distances) {
    if (!mesh?.userData) return null
    
    const n = mesh.userData.number
    const isClosure = !!mesh.userData.isClosure
    const closureMm = mesh.userData.closureLengthMm
    
    // В hover: первый размер = вдоль ряда (Длина), второй = толщина (Ширина ряд), третий = высота
    const brickAlongRow = props.brickLength
    const brickThickness = props.brickWidth
    const brickH = props.brickHeight
    
    // Формируем строку размеров: вдоль ряда × толщина × высота (у замыкающего вдоль ряда = closureMm)
    const dims = closureMm != null
      ? `${closureMm}×${brickThickness}×${brickH} мм`
      : `${brickAlongRow}×${brickThickness}×${brickH} мм`
    
    // Находим расстояния до предыдущего и следующего кирпичей
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

  /**
   * Создаёт полосатый анимированный оверлей для hover-кирпича.
   * Использует шейдерный материал с движущимися чёрно-белыми полосами.
   * @param {THREE.BufferGeometry} geometry - Геометрия кирпича (клонированная)
   * @returns {THREE.Mesh} Меш с полосатым оверлеем
   */
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
    mesh.renderOrder = 1  // Рендерится поверх основного меша
    mesh.userData.stripeUniforms = uniforms  // Для обновления времени в анимации
    return mesh
  }

  /**
   * Удаляет полосатый оверлей с hover-кирпича и освобождает память.
   */
  function removeStripeOverlay() {
    if (stripeOverlayMesh?.parent) {
      stripeOverlayMesh.parent.remove(stripeOverlayMesh)
      stripeOverlayMesh.geometry?.dispose?.()
      stripeOverlayMesh.material?.dispose?.()
    }
    stripeOverlayMesh = null
  }

  /**
   * Возвращает текущий полосатый оверлей (для обновления времени в анимации).
   * @returns {THREE.Mesh|null} Меш оверлея или null
   */
  function getStripeOverlay() {
    return stripeOverlayMesh
  }

  /**
   * Добавляет лейблы сторон N/S/E/W к мешу кирпича (в локальной системе: +X=N, -X=S, +Z=E, -Z=W).
   */
  function addSideLabels(mesh, halfW, halfL, baseFontSize) {
    const sideLabels = []
    const positions = [
      { pos: [halfW, 0, 0], text: 'N' },
      { pos: [-halfW, 0, 0], text: 'S' },
      { pos: [0, 0, halfL], text: 'E' },
      { pos: [0, 0, -halfL], text: 'W' },
    ]
    positions.forEach(({ pos, text }) => {
      const div = document.createElement('div')
      div.className = 'brick-label brick-label-side'
      div.textContent = text
      div.style.fontSize = `${Math.max(8, baseFontSize * 0.8)}px`
      const obj = new CSS2DObject(div)
      obj.position.set(...pos)
      obj.center.set(0.5, 0.5)
      obj.visible = !!props.showBrickSides
      mesh.add(obj)
      sideLabels.push({ el: div, obj })
    })
    return sideLabels
  }

  /**
   * Ставит один меш (Z, N или E) на стене и добавляет в wallsGroup.
   * type: 'Z1' | 'Z' | 'Z_TO_Z1' | 'N' | 'E'. Z_TO_Z1 — замыкающий до края z1 (жёлто-зелёный).
   */
  function placeBrick(wallsGroup, wall, pos, lenAlong, type, brickNumber, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries) {
    const x = brickW
    const halfW = brickW / 2
    const halfL = brickL / 2
    const EPS = 1e-9
    const isGap = type === 'E'
    const isClosureToZ1 = type === 'Z_TO_Z1'
    const isClosure = type === 'Z1' || type === 'Z' || isClosureToZ1

    let geom, mat, lineMat
    if (isGap) {
      const gapLen = Math.max(0.001, Math.min(0.003, lenAlong))
      geom = new THREE.BoxGeometry(gapLen, brickH, brickL)
      gapGeometries.push(geom)
      mat = gapMaterial
      lineMat = null
    } else {
      if (isClosure) {
        geom = new THREE.BoxGeometry(lenAlong, brickH, brickL)
        closureGeometries.push(geom)
        mat = isClosureToZ1 ? closureToZ1Material : closureBrickMaterial
        lineMat = isClosureToZ1 ? closureToZ1LineMaterial : closureBrickLineMaterial
      } else {
        geom = lastBrickGeometry
        mat = lastBrickMaterial
        lineMat = lastLineMaterial
      }
    }

    const mesh = new THREE.Mesh(geom, mat)
    mesh.scale.set(1, brickMargin, brickMargin)
    mesh.castShadow = true
    mesh.receiveShadow = true

    if (!isGap) {
      const edgesGeom = geom === lastBrickGeometry ? lastEdgesGeometry : new THREE.EdgesGeometry(geom)
      if (geom !== lastBrickGeometry) closureGeometries.push(edgesGeom)
      mesh.add(new THREE.LineSegments(edgesGeom, lineMat))
    }

    const centerAlong = pos + lenAlong / 2
    const worldPos = wall.start.clone()
      .add(wall.dir.clone().multiplyScalar(centerAlong))
      .add(wall.inward.clone().multiplyScalar(halfThickness))
    worldPos.y = y

    mesh.rotation.y = wall.rotY
    mesh.position.copy(worldPos)

    const userData = {
      wallIndex: wall.wallIndex,
      row: 0,
      isClosure: isClosure,
      isClosureToZ1: isClosureToZ1,
      closureLengthMm: isClosure ? Math.round(lenAlong * 1000) : null,
    }

    if (isGap) {
      userData.type = 'gap'
    } else {
      userData.number = brickNumber
      const labelDiv = document.createElement('div')
      labelDiv.className = isClosureToZ1 ? 'brick-label brick-label-closure-to-z1' : (isClosure ? 'brick-label brick-label-closure' : 'brick-label')
      labelDiv.textContent = brickNumber
      labelDiv.style.fontSize = `${baseFontSize}px`
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(0, 0, 0)
      labelObj.center.set(0.5, 0.5)
      mesh.add(labelObj)
      userData.labelEl = labelDiv
      userData.labelObj = labelObj
      userData.sideLabels = addSideLabels(mesh, halfW, halfL, baseFontSize)
      updateLabelVisibility(mesh, props.showAllNumbers, false)
    }

    mesh.userData = userData
    wallsGroup.add(mesh)
  }

  /**
   * ГЛАВНАЯ ФУНКЦИЯ: Один круг по периметру.
   * Z1 (2x) → E → N → E → N → … до края → Z (отступ от кирпича Z) → E → N → … → En перед Z1 → СТОП.
   * E рисуется цветом зазора (props.gapColor).
   */
  function buildDistributionWalls(L, W, brickW, brickL, brickH, gapM) {
    const { wallsGroup } = refs()
    if (!wallsGroup) return

    const baseFontSize = 10 * (props.labelSize || 1)
    const halfW = brickW / 2
    const x = brickW

    const minGapM = 0.001
    const maxGapM = Math.max(minGapM, Math.min(gapM, 0.003))
    const randomGapM = () => minGapM + Math.random() * (maxGapM - minGapM)

    const rowGapM = Math.min(Math.max(gapM, 0.001), 0.003)
    const halfThickness = (brickL * brickMargin) / 2

    const lenX = 2 * L
    const lenZ = 2 * W
    const perimeter = 2 * (lenX + lenZ)
    const EPS = 1e-9

    const walls = [
      { len: lenX, start: new THREE.Vector3(-L, 0, -W), dir: new THREE.Vector3(1, 0, 0), inward: new THREE.Vector3(0, 0, 1), rotY: 0, wallIndex: 0 },
      { len: lenZ, start: new THREE.Vector3(L, 0, -W), dir: new THREE.Vector3(0, 0, 1), inward: new THREE.Vector3(-1, 0, 0), rotY: Math.PI / 2, wallIndex: 1 },
      { len: lenX, start: new THREE.Vector3(L, 0, W), dir: new THREE.Vector3(-1, 0, 0), inward: new THREE.Vector3(0, 0, -1), rotY: Math.PI, wallIndex: 2 },
      { len: lenZ, start: new THREE.Vector3(-L, 0, W), dir: new THREE.Vector3(0, 0, -1), inward: new THREE.Vector3(1, 0, 0), rotY: -Math.PI / 2, wallIndex: 3 },
    ]

    function toWallPos(s) {
      let t = perimeter > EPS ? ((s % perimeter) + perimeter) % perimeter : 0
      for (let wi = 0; wi < walls.length; wi++) {
        if (t >= walls[wi].len - EPS) {
          t -= walls[wi].len
          continue
        }
        return { wi, pos: t }
      }
      return { wi: 0, pos: 0 }
    }

    const gapColorHex = typeof props.gapColor === 'string' ? props.gapColor.replace('#', '0x') : '0x888888'
    lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
    lastBrickMaterial = new THREE.MeshLambertMaterial({ color: brickColor, flatShading: true })
    closureBrickMaterial = new THREE.MeshLambertMaterial({ color: closureBrickColor, flatShading: true })
    closureToZ1Material = new THREE.MeshLambertMaterial({ color: closureToZ1Color, flatShading: true })
    gapMaterial = new THREE.MeshLambertMaterial({ color: parseInt(gapColorHex, 16), flatShading: true })
    lastEdgesGeometry = new THREE.EdgesGeometry(lastBrickGeometry)
    lastLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(props.edgeColor), linewidth: 1 })
    closureBrickLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('#ff0000'), linewidth: 1 })
    closureToZ1LineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('#9acd32'), linewidth: 1 })

    const y = brickH / 2
    let brickNumber = 1
    const maxBricks = Math.max(1, Math.floor(props.distributionBrickCount))

    const z1Len = 2 * x
    const wall0 = walls[0]
    placeBrick(wallsGroup, wall0, 0, z1Len, 'Z1', brickNumber++, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)

    let s = z1Len
    while (true) {
      if (brickNumber - 1 >= maxBricks) break

      // Расстояние по периметру от текущей позиции s до точки старта круга (где стоит z1).
      const remainingToStart = perimeter - s
      // Случайный зазор E (1–3 мм) для следующей пары E+N.
      const gapE = randomGapM()

      // Места не хватает на полный цикл «зазор E + кирпич N» — замыкаем круг.
      if (remainingToStart < gapE + x - EPS) {
        // Если до z1 остался хоть небольшой промежуток — ставим последний зазор En, чтобы визуально замкнуть ряд.
        if (remainingToStart > EPS) {
          const enLen = Math.max(minGapM, Math.min(gapE, remainingToStart))
          const { wi, pos } = toWallPos(s)
          const wall = walls[wi]
          placeBrick(wallsGroup, wall, pos, enLen, 'E', null, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
        }
        break
      }

      // Правило: если следующий кирпич (Nn) после E оказался бы в зоне «до z1 ≤ 2x», то он (Nn) становится замыкающим.
      // Длина = до западного края z1 (вплотную, без перекрытия с предыдущим кирпичом): zLenRaw = remainingToStart - gapE.
      // (+ z1Len давало бы «до восточного края» и приводило к пересечению с N-1.)
      //
      // distFromNextNEndToZ1 — расстояние от восточного края «следующего N» до z1.
      const distFromNextNEndToZ1 = remainingToStart - gapE - x
      if (distFromNextNEndToZ1 <= 2 * x + EPS && remainingToStart > gapE + EPS) {
        const zLenRaw = remainingToStart - gapE - brickW  // до западного края z1, вплотную
        if (zLenRaw >= x - EPS) {
          const zLen = Math.max(x, zLenRaw)  // правило: замыкающий не короче x
          const { wi, pos } = toWallPos(s)
          const wall = walls[wi]
          placeBrick(wallsGroup, wall, pos, gapE, 'E', null, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
          placeBrick(wallsGroup, wall, pos + gapE, zLen, 'Z_TO_Z1', brickNumber++, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
          break
        }
        // иначе zLenRaw < x — не ставим короткий замыкающий, идём в E + N
      }

      const { wi, pos } = toWallPos(s)
      const wall = walls[wi]
      const remaining = Math.max(0, wall.len - pos)

      if (remaining >= x - EPS && remaining <= 2 * x + EPS && s > z1Len + EPS) {
        // Z (замыкающий, не Z1). Правило: замыкающий только если остаток >= x (не короче x).
        const lenAlong = remaining
        placeBrick(wallsGroup, wall, pos, lenAlong, 'Z', brickNumber++, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
        s += lenAlong + brickL
        continue
      }

      // E + N
      placeBrick(wallsGroup, wall, pos, gapE, 'E', null, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
      s += gapE
      placeBrick(wallsGroup, wall, pos + gapE, x, 'N', brickNumber++, y, brickW, brickL, brickH, halfThickness, baseFontSize, closureGeometries, gapGeometries)
      s += x
    }

    hoveredBrickMesh = null
  }

  /**
   * Главная функция построения стен: очищает старую сцену и вызывает buildDistributionWalls.
   * Вызывается из HouseCanvas.vue при изменении пропсов или при инициализации.
   */
  function buildWalls() {
    const { wallsGroup } = refs()
    if (!wallsGroup) return

    // ========== ОЧИСТКА СТАРОЙ СЦЕНЫ ==========
    // Удаляем все существующие меши кирпичей
    while (wallsGroup.children.length > 0) {
      const mesh = wallsGroup.children[0]
      cleanupLabelElements(mesh)  // Удаляем DOM-элементы подписей
      wallsGroup.remove(mesh)
    }
    
    // Освобождаем память: dispose старых геометрий и материалов
    lastBrickGeometry?.dispose()
    lastBrickMaterial?.dispose()
    lastEdgesGeometry?.dispose()
    lastLineMaterial?.dispose()
    closureBrickMaterial?.dispose()
    closureBrickLineMaterial?.dispose()
    closureToZ1Material?.dispose()
    closureToZ1LineMaterial?.dispose()
    gapMaterial?.dispose()
    closureGeometries.forEach((g) => g.dispose())
    closureGeometries = []
    gapGeometries.forEach((g) => g.dispose())
    gapGeometries = []

    // ========== КОНВЕРТАЦИЯ РАЗМЕРОВ ==========
    // UI «Длина» = размер вдоль ряда (x), «Ширина (ряд)» = толщина кирпича (z). Не путать с именами пропсов.
    const L = props.houseLength / 2      // Половина длины дома (м)
    const W = props.houseWidth / 2       // Половина ширины дома (м)
    const brickW = props.brickLength / 1000   // вдоль ряда (в 3D — ось по стене) = UI «Длина»
    const brickL = props.brickWidth / 1000    // толщина (в 3D — ось внутрь стены) = UI «Ширина (ряд)»
    const brickH = props.brickHeight / 1000
    const gapM = props.brickGap / 1000

    // ========== ПОСТРОЕНИЕ СТЕН ==========
    const N = Math.max(0, Number(props.distributionBrickCount))
    if (N > 0) {
      buildDistributionWalls(L, W, brickW, brickL, brickH, gapM)
    }
    // Если N === 0, сцена остаётся пустой (нет кирпичей)
  }

  /**
   * Обработчик движения мыши: определяет кирпич под курсором и обновляет hover-эффекты.
   * Использует raycaster для определения пересечения луча из камеры с мешами кирпичей.
   * При наведении на кирпич:
   * - Показывает подпись-номер
   * - Добавляет полосатый оверлей
   * - Эмитит событие 'brick-hover' с данными кирпича
   * @param {MouseEvent} event - Событие движения мыши
   */
  function onPointerMove(event) {
    const { wallsGroup, raycaster, mouse, camera, containerRef } = refs()
    if (!containerRef?.value || !camera || !wallsGroup) return
    
    // Преобразуем координаты мыши в нормализованные координаты (-1..1)
    const rect = containerRef.value.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    // Запускаем луч из камеры в точку экрана
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(wallsGroup.children, true)
    
    // Находим первый пересечённый меш с номером кирпича (пропускаем дочерние объекты типа LineSegments)
    let hitObj = intersects[0]?.object
    while (hitObj && hitObj.userData?.number == null) hitObj = hitObj.parent
    const hit = hitObj?.userData?.number != null ? hitObj : null
    
    // Если hover-кирпич изменился
    if (hit !== hoveredBrickMesh) {
      // Убираем подсветку со старого кирпича
      if (hoveredBrickMesh?.userData?.labelEl) {
        updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
      }
      removeStripeOverlay()
      
      // Устанавливаем новый hover-кирпич
      hoveredBrickMesh = hit || null
      
      // Добавляем подсветку новому кирпичу
      if (hoveredBrickMesh?.userData?.labelEl) {
        updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, true)
      }
      
      // Добавляем полосатый оверлей
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
      // Если hover-кирпич не изменился, но мышь движется — обновляем данные (для UXUI панели)
      const distances = getBrickDistances()
      const data = buildBrickHoverData(hoveredBrickMesh, distances)
      emit('brick-hover', { data, pointerX: event.clientX, pointerY: event.clientY })
    }
  }

  /**
   * Обработчик ухода мыши из контейнера: снимает подсветку и оверлей.
   */
  function onPointerLeave() {
    if (hoveredBrickMesh?.userData?.labelEl) {
      updateLabelVisibility(hoveredBrickMesh, props.showAllNumbers, false)
    }
    removeStripeOverlay()
    hoveredBrickMesh = null
    emit('brick-hover', { data: null, pointerX: 0, pointerY: 0 })
  }

  /**
   * Очистка всех кирпичей и освобождение памяти.
   * Вызывается при размонтировании компонента (onUnmounted).
   */
  function cleanupBricks() {
    const { wallsGroup } = refs()
    removeStripeOverlay()
    hoveredBrickMesh = null
    
    // Удаляем все DOM-элементы подписей
    wallsGroup?.traverse?.((obj) => {
      if (obj.isCSS2DObject && obj.element?.parentNode) {
        obj.element.parentNode.removeChild(obj.element)
      }
    })
    
    wallsGroup?.clear?.()
  }

  // ========== ЭКСПОРТ ПУБЛИЧНЫХ ФУНКЦИЙ ==========
  return {
    buildWalls,                    // Построение стен из кирпичей
    getBrickDistances,              // Вычисление расстояний между кирпичами
    logBrickDistances,              // Лог расстояний в консоль (отладка)
    updateDimensionsArrows,        // Обновление стрелок размеров
    updateAllLabelsVisibility,     // Обновление видимости всех подписей
    onPointerMove,                  // Обработчик движения мыши
    onPointerLeave,                 // Обработчик ухода мыши
    getStripeOverlay,               // Получение полосатого оверлея (для анимации)
    cleanupBricks,                  // Очистка и освобождение памяти
  }
}
