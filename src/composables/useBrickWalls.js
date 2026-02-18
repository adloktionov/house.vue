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

const ARROW_COLOR = 0xffff00                       // Цвет стрелок размеров (жёлтый)
const LABEL_BG = '#e67e22'                        // Фон подписи размеров
const LABEL_TEXT = '#000000'                      // Текст подписи размеров

export function useBrickWalls(props, emit, getSceneRefs) {
  // ========== ВНУТРЕННИЕ ПЕРЕМЕННЫЕ ==========
  // Общие геометрия и материалы для всех обычных кирпичей (экономия памяти)
  let lastBrickGeometry, lastBrickMaterial, lastEdgesGeometry, lastLineMaterial
  // Материалы для замыкающих кирпичей (красные)
  let closureBrickMaterial, closureBrickLineMaterial
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
   * Добавляет стрелки размеров (X, Y, Z) к кирпичу с подписями.
   * Создаёт три ArrowHelper (по осям X, Y, Z) и CSS2DObject подписи с размерами.
   * Для замыкающих кирпичей использует красный цвет и реальную длину вместо стандартной.
   * @param {THREE.Mesh} mesh - Меш кирпича
   * @param {number} brickW - Ширина кирпича (м)
   * @param {number} brickH - Высота кирпича (м)
   * @param {number} brickL - Длина кирпича (м)
   * @param {Object} opts - Опции: {isClosure: boolean, closureLengthMm: number, closureAxis: string}
   */
  function addDimensionArrowsToBrick(mesh, brickW, brickH, brickL, opts = {}) {
    const { isClosure = false, closureLengthMm = null, closureAxis = 'z' } = opts
    const closureLen = closureLengthMm != null ? closureLengthMm / 1000 : null
    const dimZ = closureLen != null && closureAxis === 'z' ? closureLen : brickL
    
    // Начальная точка для стрелок (нижний левый угол кирпича)
    const vertex = new THREE.Vector3(-brickW / 2, -brickH / 2, -dimZ / 2)
    
    // Цвета и стили в зависимости от типа кирпича
    const arrowColor = isClosure ? 0xff0000 : ARROW_COLOR
    const labelBg = isClosure ? '#ff0000' : LABEL_BG
    const labelText = isClosure ? '#ffffff' : LABEL_TEXT
    
    // Три оси: X (ширина), Y (высота), Z (длина)
    const axes = [
      { axis: 'x', dir: new THREE.Vector3(1, 0, 0), len: brickW, label: props.brickWidth },
      { axis: 'y', dir: new THREE.Vector3(0, 1, 0), len: brickH, label: props.brickHeight },
      { axis: 'z', dir: new THREE.Vector3(0, 0, 1), len: brickL, label: props.brickLength },
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
            ? { isClosure: true, closureLengthMm: obj.userData.closureLengthMm, closureAxis: 'z' }
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
    const { labelEl, labelObj } = mesh.userData || {}
    if (!labelEl || !labelObj) return
    
    const show = showAll || isHovered
    labelObj.visible = show
    labelEl.classList.toggle('brick-label-hover', isHovered)
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
    
    const brickW = props.brickWidth
    const brickL = props.brickLength
    const brickH = props.brickHeight
    
    // Формируем строку размеров (для замыкающих используем реальную длину)
    const dims = closureMm != null
      ? `${brickW}×${brickH}×${closureMm} мм`
      : `${brickW}×${brickL}×${brickH} мм`
    
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
   * ГЛАВНАЯ ФУНКЦИЯ: Строит стены из кирпичей по периметру дома.
   * Распределяет N кирпичей по периметру, создавая несколько рядов с чередованием.
   * Обрабатывает замыкающие (обрезанные) кирпичи на углах.
   * 
   * Алгоритм:
   * 1. Строит траекторию из 4 сегментов (стен) вокруг фундамента
   * 2. Вычисляет периметр и количество кирпичей в одном круге
   * 3. Для каждого кирпича:
   *    - Определяет ряд и позицию в круге
   *    - Вычисляет расстояние вдоль периметра (с учётом смещения рядов)
   *    - Проверяет необходимость замыкающего кирпича на углу
   *    - Создаёт меш с геометрией, материалом, подписью
   *    - Размещает кирпич в 3D-пространстве
   * 
   * @param {number} L - Половина длины дома (м)
   * @param {number} W - Половина ширины дома (м)
   * @param {number} brickW - Ширина кирпича (м)
   * @param {number} brickL - Длина кирпича (м)
   * @param {number} brickH - Высота кирпича (м)
   * @param {number} gapM - Зазор между кирпичами (м)
   */
  function buildDistributionWalls(L, W, brickW, brickL, brickH, gapM) {
    const { wallsGroup } = refs()
    if (!wallsGroup) return

    // ========== ПОДГОТОВКА ПАРАМЕТРОВ ==========
    const halfW = brickW / 2
    const halfL = brickL / 2
    const baseFontSize = 10 * (props.labelSize || 1)
    const n = Math.max(1, Math.floor(props.distributionBrickCount))  // Минимум 1 кирпич
    
    // Размер кирпича вдоль траектории (всегда берём большую сторону, т.к. кирпич может поворачиваться).
    // По смыслу это длина «обычного» кирпича N в паре N + E (E — пустой кирпич‑зазор).
    const brickAlongPath = Math.max(brickW, brickL)
    const halfBrickAlongPath = brickAlongPath / 2

    // ===== Рандомизация зазоров (пустых кирпичей E) =====
    // Пользователь задаёт максимальный зазор в мм (props.brickGap, 1–3 мм).
    // Мы трактуем это как Ymax, а Ymin всегда 1 мм. Каждый конкретный зазор Y_i берём случайно в [Ymin, Ymax].
    const minGapM = 0.001                                   // 1 мм
    const maxGapM = Math.max(minGapM, Math.min(gapM, 0.003)) // не больше 3 мм и не меньше 1 мм
    const avgGapM = (minGapM + maxGapM) / 2
    const randomGapM = () => minGapM + Math.random() * (maxGapM - minGapM)

    // Полная длина кирпича N вдоль траектории с учётом масштаба brickMargin (визуальный зазор внутри кирпича).
    const brickExtentM = brickAlongPath * brickMargin

    // Оценочный шаг между центрами N_i и N_{i+1}:
    //   stepEst ≈ длина кирпича (с учётом brickMargin) + средний зазор E (avgGapM).
    // Это используется только для оценки того, сколько кирпичей помещается в один «круг» по периметру.
    const stepEst = brickExtentM + avgGapM

    // Минимальный зазор между рядами (по высоте) и между замыкающим кирпичом и следующим рядом (1–3 мм).
    // Это зазор по оси Y (ряды), а не вдоль стены.
    const closureGapM = Math.min(Math.max(gapM, 0.001), 0.003)

    // ========== ПОСТРОЕНИЕ ТРАЕКТОРИИ ПО ПЕРИМЕТРУ ==========
    // Массив из 4 сегментов (стен) вокруг фундамента
    // Каждый сегмент имеет длину и функцию get(t) для получения точки на стене
    const segs = [
      // Передняя стена (по X, снизу, z = -W)
      { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: -L + halfL + t * (2 * L - brickL), z: -W, wallIndex: 0, rotate90: true }) },
      // Правая стена (по Z, справа, x = L)
      { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: L, z: -W + halfW + t * (2 * W - brickW), wallIndex: 1, rotate90: false }) },
      // Задняя стена (по X, сверху, z = W)
      { len: Math.max(0, 2 * L - brickL), get: (t) => ({ x: L - halfL - t * (2 * L - brickL), z: W, wallIndex: 2, rotate90: true }) },
      // Левая стена (по Z, слева, x = -L)
      { len: Math.max(0, 2 * W - brickW), get: (t) => ({ x: -L, z: W - halfW - t * (2 * W - brickW), wallIndex: 3, rotate90: false }) },
    ]

    // Вычисляем общий периметр (сумма длин всех сегментов)
    const perimeter = segs.reduce((sum, s) => sum + s.len, 0)
    
    // Массив накопленных концов сегментов (для быстрого определения, на каком сегменте находится расстояние)
    const segEnds = []
    let acc = 0
    for (let s = 0; s < segs.length; s++) {
      if (segs[s].len > 0) acc += segs[s].len
      segEnds.push(acc)
    }
    
    // Количество кирпичей в одном круге по периметру (приблизительная оценка по среднему шагу).
    const bricksPerLap = perimeter > 1e-6 ? Math.max(1, Math.floor(perimeter / stepEst)) : n

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ НАВИГАЦИИ ПО ТРАЕКТОРИИ ==========
    
    /**
     * По расстоянию вдоль периметра находит точку на траектории.
     * Определяет, на каком сегменте находится расстояние, и вызывает get(t) для этого сегмента.
     * @param {number} dist - Расстояние вдоль периметра (м)
     * @returns {Object} {x, z, wallIndex, rotate90}
     */
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

    /**
     * Находит конец сегмента, на котором находится расстояние.
     * @param {number} dist - Расстояние вдоль периметра (м)
     * @returns {number} Расстояние до конца сегмента
     */
    function getSegmentEnd(dist) {
      const d = perimeter > 1e-6 ? dist % perimeter : 0
      for (let s = 0; s < segEnds.length; s++) {
        if (d < segEnds[s]) return segEnds[s]
      }
      return perimeter
    }

    /**
     * Определяет индекс сегмента (0-3), на котором находится расстояние.
     * @param {number} dist - Расстояние вдоль периметра (м)
     * @returns {number} Индекс сегмента
     */
    function getSegmentIndex(dist) {
      const d = perimeter > 1e-6 ? dist % perimeter : 0
      for (let s = 0; s < segEnds.length; s++) {
        if (d < segEnds[s]) return s
      }
      return segEnds.length - 1
    }

    /**
     * Вычисляет расстояние до физического угла (с учётом половины кирпича).
     * @param {number} dist - Расстояние вдоль периметра (м)
     * @returns {number} Расстояние до угла
     */
    function getCornerDist(dist) {
      const s = getSegmentIndex(dist)
      const ext = (s === 0 || s === 2) ? halfL : halfW  // Для сегментов 0,2 используется halfL, для 1,3 — halfW
      return segEnds[s] + ext
    }

    /**
     * Вычисляет расстояние до угла предыдущего сегмента (для стыковки замыкающих кирпичей).
     * @param {number} segIndex - Индекс текущего сегмента
     * @returns {number} Расстояние до угла предыдущего сегмента
     */
    function getPrevSegmentCornerDist(segIndex) {
      if (segIndex <= 0) return 0
      const ext = (segIndex === 1 || segIndex === 3) ? halfL : halfW
      return segEnds[segIndex - 1] + ext
    }

    // ========== СОЗДАНИЕ ОБЩИХ ГЕОМЕТРИЙ И МАТЕРИАЛОВ ==========
    // Общая геометрия для всех обычных кирпичей (экономия памяти)
    lastBrickGeometry = new THREE.BoxGeometry(brickW, brickH, brickL)
    lastBrickMaterial = new THREE.MeshLambertMaterial({ color: brickColor, flatShading: true })
    
    // Материалы для замыкающих кирпичей (красные)
    closureBrickMaterial = new THREE.MeshLambertMaterial({ color: closureBrickColor, flatShading: true })
    
    // Геометрия рёбер для контура кирпичей
    lastEdgesGeometry = new THREE.EdgesGeometry(lastBrickGeometry)
    
    // Материалы для линий контура
    lastLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(props.edgeColor), linewidth: 1 })
    closureBrickLineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color('#ff0000'), linewidth: 1 })

    // ========== ОСНОВНОЙ ЦИКЛ СОЗДАНИЯ КИРПИЧЕЙ ==========
    // Здесь реализуется последовательность N1 + E1 + N2 + E2 + ... + Z:
    // - N — обычный кирпич
    // - E — «пустой кирпич» (зазор) случайной длины от 1 до props.brickGap мм
    //
    // В геометрии мы не рисуем E, он учитывается только как дополнительное смещение центра следующего кирпича.
    // Расстояние между центрами N_i и N_{i+1} = brickExtentM + randomGapM().
    let distAlong = 0 // текущее расстояние вдоль периметра для центра кирпича (не по модулю)

    for (let i = 0; i < n; i++) {
      // Определяем ряд и позицию в круге (по оценочному количеству кирпичей на один обход)
      const row = Math.floor(i / bricksPerLap)           // Номер ряда (0, 1, 2, ...)
      const posInLap = i % bricksPerLap                  // Позиция в текущем круге (0..bricksPerLap-1)
      
      // Для каждого ряда делаем небольшое смещение на полкирпича (чередование швов),
      // но distAlong накапливаем глобально, чтобы зазоры E_i не сбрасывались.
      if (posInLap === 0) {
        const offsetForRow = (row % 2) * halfBrickAlongPath
        distAlong = offsetForRow
      }

      // Оборачиваем расстояние в пределах периметра для поиска сегмента и точки
      const distWrapped = perimeter > 1e-6 ? distAlong % perimeter : 0
      
      // Высота кирпича (центр по Y)
      const y = row * (brickH + closureGapM) + brickH / 2

      // Определяем сегмент и угол
      const segIndex = getSegmentIndex(distWrapped)
      const cornerDist = getCornerDist(distWrapped)
      
      // ========== ОПРЕДЕЛЕНИЕ ЗАМЫКАЮЩЕГО КИРПИЧА ==========
      // Полудлина кирпича вдоль пути на текущем сегменте
      const halfExtentSeg = (segIndex === 0 || segIndex === 2) ? halfL * brickMargin : halfW * brickMargin
      
      // Расстояние от края кирпича до угла
      const distFromEdgeToCorner = cornerDist - (distWrapped + halfExtentSeg)
      
      // Размер кирпича вдоль пути на текущем сегменте (без учёта brickMargin)
      const brickExtentSeg = (segIndex === 0 || segIndex === 2) ? brickL : brickW
      
      // Кирпич становится замыкающим, если его край не достаёт до угла, но расстояние меньше длины целого кирпича
      const needClosure = distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < brickExtentSeg
      
      // Вычисляем длину замыкающего кирпича (в метрах)
      const closureLenM = needClosure ? Math.min(cornerDist - (distWrapped - halfExtentSeg), 2 * brickAlongPath) : null
      const closureLen = closureLenM != null ? closureLenM / brickMargin : null
      
      // Позиция центра кирпича: для замыкающего — середина между началом и углом, иначе — обычная позиция
      const posDist = needClosure ? (distWrapped - halfExtentSeg + cornerDist) / 2 : distWrapped
      const pt = pointAtDistance(posDist)

      // ========== СОЗДАНИЕ ГЕОМЕТРИИ ==========
      let geom = lastBrickGeometry
      if (closureLen != null) {
        // Замыкающий кирпич — создаём новую геометрию с другой длиной
        const g = new THREE.BoxGeometry(brickW, brickH, closureLen)
        closureGeometries.push(g)  // Сохраняем для последующего dispose
        geom = g
      }

      // ========== СОЗДАНИЕ МАТЕРИАЛОВ И МЕША ==========
      const mat = needClosure ? closureBrickMaterial : lastBrickMaterial
      const lineMat = needClosure ? closureBrickLineMaterial : lastLineMaterial
      const mesh = new THREE.Mesh(geom, mat)
      
      // Масштабируем меш для визуального зазора между кирпичами
      mesh.scale.set(brickMargin, brickMargin, brickMargin)
      mesh.castShadow = true
      mesh.receiveShadow = true
      
      // Добавляем контур (рёбра) кирпича
      const edgesGeom = geom === lastBrickGeometry ? lastEdgesGeometry : new THREE.EdgesGeometry(geom)
      if (geom !== lastBrickGeometry) closureGeometries.push(edgesGeom)
      mesh.add(new THREE.LineSegments(edgesGeom, lineMat))
      
      // ========== СОЗДАНИЕ ПОДПИСИ-НОМЕРА ==========
      const labelDiv = document.createElement('div')
      labelDiv.className = needClosure ? 'brick-label brick-label-closure' : 'brick-label'
      labelDiv.textContent = i + 1
      labelDiv.style.fontSize = `${baseFontSize}px`
      const labelObj = new CSS2DObject(labelDiv)
      labelObj.position.set(0, 0, 0)
      labelObj.center.set(0.5, 0.5)
      mesh.add(labelObj)
      
      // Сохраняем метаданные кирпича
      mesh.userData = {
        number: i + 1,
        wallIndex: pt.wallIndex,
        row,
        labelEl: labelDiv,
        labelObj,
        isClosure: needClosure,
        closureLengthMm: closureLenM != null ? Math.round(closureLenM * 1000) : null,
      }
      
      // Обновляем видимость подписи
      updateLabelVisibility(mesh, props.showAllNumbers, false)
      
      // ========== ПОВОРОТ КИРПИЧА ==========
      // Для стен вдоль X (сегменты 0 и 2) поворачиваем кирпич на 90°
      if (pt.rotate90) mesh.rotation.y = Math.PI / 2
      
      // ========== СМЕЩЕНИЕ ВНУТРЬ ОТ КРАЯ И ФИНАЛЬНАЯ ПОЗИЦИЯ ==========
      // Траектория идёт по краю фундамента, поэтому центр кирпича нужно сместить внутрь
      // на половину толщины кирпича (чтобы кирпич не выходил за границу)
      const halfExtX = (pt.wallIndex === 1 || pt.wallIndex === 3) ? halfW * brickMargin : 0
      const halfExtZ = (pt.wallIndex === 0 || pt.wallIndex === 2) ? halfW * brickMargin : 0
      const dx = (pt.wallIndex === 1 ? -halfExtX : pt.wallIndex === 3 ? halfExtX : 0)
      const dz = (pt.wallIndex === 0 ? halfExtZ : pt.wallIndex === 2 ? -halfExtZ : 0)
      
      // Устанавливаем финальную позицию кирпича
      mesh.position.set(pt.x + dx, y, pt.z + dz)
      
      // Добавляем кирпич в группу стен
      wallsGroup.add(mesh)

      // После установки кирпича сдвигаем расстояние вдоль периметра:
      // центр следующего кирпича = центр текущего + длина кирпича (с учётом brickMargin) + случайный зазор E.
      // Таким образом реализуем пару N + E (E — пустой кирпич‑зазор).
      distAlong += brickExtentM + randomGapM()
    }

    // Сбрасываем hover-кирпич после пересборки
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
    closureGeometries.forEach((g) => g.dispose())
    closureGeometries = []

    // ========== КОНВЕРТАЦИЯ РАЗМЕРОВ ==========
    const L = props.houseLength / 2      // Половина длины дома (м)
    const W = props.houseWidth / 2       // Половина ширины дома (м)
    const brickW = props.brickWidth / 1000
    const brickL = props.brickLength / 1000
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
    updateDimensionsArrows,        // Обновление стрелок размеров
    updateAllLabelsVisibility,     // Обновление видимости всех подписей
    onPointerMove,                  // Обработчик движения мыши
    onPointerLeave,                 // Обработчик ухода мыши
    getStripeOverlay,               // Получение полосатого оверлея (для анимации)
    cleanupBricks,                  // Очистка и освобождение памяти
  }
}
