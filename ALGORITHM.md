# Алгоритм распределения кирпичей по периметру дома

## Обзор

Алгоритм размещает заданное количество кирпичей (`distributionBrickCount`) по периметру прямоугольного фундамента дома. Кирпичи распределяются в несколько рядов, с учётом:
- Чередования рядов (смещение на полкирпича для разбежки швов)
- Замыкающих (обрезанных) кирпичей на углах
- Минимальных зазоров между кирпичами
- Смещения центров кирпичей внутрь от края фундамента

---

## Шаг 1: Подготовка входных данных

### Вызов `buildWalls()`

Когда родительский компонент вызывает `updateScene()`, происходит:

1. **Очистка старой сцены:**
   - Удаление всех существующих мешей кирпичей из `wallsGroup`
   - Освобождение памяти (dispose) старых геометрий и материалов

2. **Конвертация размеров в метры:**
   ```js
   L = houseLength / 2      // половина длины дома (по оси X)
   W = houseWidth / 2       // половина ширины дома (по оси Z)
   brickW = brickWidth / 1000
   brickL = brickLength / 1000
   brickH = brickHeight / 1000
   gapM = brickGap / 1000
   ```

3. **Проверка количества кирпичей:**
   ```js
   N = Math.max(0, Math.floor(props.distributionBrickCount))
   if (N > 0) {
     buildDistributionWalls(L, W, brickW, brickL, brickH, gapM)
   }
   ```

---

## Шаг 2: Инициализация параметров распределения

В начале `buildDistributionWalls()` вычисляются базовые параметры:

### Базовые размеры
```js
halfW = brickW / 2
halfL = brickL / 2
n = Math.max(1, Math.floor(props.distributionBrickCount))  // минимум 1 кирпич
```

### Размер кирпича вдоль траектории и визуальный зазор
```js
brickAlongPath = Math.max(brickW, brickL)   // всегда берём большую сторону
halfBrickAlongPath = brickAlongPath / 2

brickExtentM = brickAlongPath * brickMargin // фактическая длина кирпича N вдоль траектории
```

**Почему `max(brickW, brickL)`?** Кирпич может поворачиваться на 90° в зависимости от стены, поэтому вдоль траектории всегда используется большая сторона.

`brickMargin = 0.97` даёт небольшой **внутренний визуальный зазор**: меш кирпича чуть короче реального, поэтому даже при «математическом» стыке кирпичей они визуально не слипаются.

### Пустые кирпичи‑зазоры E (рандомизация зазоров)

Пользователь задаёт **максимальный зазор** между кирпичами в миллиметрах (`brickGap`, 1–3 мм).  
Мы трактуем это так:

- `Ymin = 1 мм` — минимальный реальный зазор
- `Ymax = brickGap` (но не больше 3 мм)
- **каждый** зазор `Y_i` выбирается случайно в диапазоне \[Ymin, Ymax\].

В коде:

```js
minGapM = 0.001                                    // 1 мм
maxGapM = Math.max(minGapM, Math.min(gapM, 0.003)) // 1–3 мм
avgGapM = (minGapM + maxGapM) / 2

randomGapM() = minGapM + Math.random() * (maxGapM - minGapM)
```

Тогда **расстояние между центрами соседних кирпичей**:

```js
// N_i — обычный кирпич, E_i — пустой кирпич‑зазор длиной Y_i
center(N_{i+1}) = center(N_i) + brickExtentM + Y_i
```

То есть по сути мы идём по траектории последовательностью:

`N1, (пустой E1), N2, (пустой E2), N3, ...`  

где пустые кирпичи E_i **не рисуются**, а только задают сдвиг центра следующего реального кирпича.

### Зазор для замыкающих кирпичей
```js
closureGapM = Math.min(Math.max(gapM, 0.001), 0.003)  // 1-3 мм
```

Минимальный зазор между замыкающим кирпичом и следующим (чтобы они не пересекались).

---

## Шаг 3: Построение траектории по периметру

Создаётся массив из 4 сегментов (стен) вокруг фундамента:

```js
segs = [
  // Передняя стена (по X, снизу, z = -W)
  {
    len: Math.max(0, 2*L - brickL),
    get: (t) => ({
      x: -L + halfL + t * (2*L - brickL),
      z: -W,
      wallIndex: 0,
      rotate90: true
    })
  },
  // Правая стена (по Z, справа, x = L)
  {
    len: Math.max(0, 2*W - brickW),
    get: (t) => ({
      x: L,
      z: -W + halfW + t * (2*W - brickW),
      wallIndex: 1,
      rotate90: false
    })
  },
  // Задняя стена (по X, сверху, z = W)
  {
    len: Math.max(0, 2*L - brickL),
    get: (t) => ({
      x: L - halfL - t * (2*L - brickL),
      z: W,
      wallIndex: 2,
      rotate90: true
    })
  },
  // Левая стена (по Z, слева, x = -L)
  {
    len: Math.max(0, 2*W - brickW),
    get: (t) => ({
      x: -L,
      z: W - halfW - t * (2*W - brickW),
      wallIndex: 3,
      rotate90: false
    })
  }
]
```

### Параметры сегмента:
- **`len`** — длина участка стены, по которому могут двигаться центры кирпичей (без выхода за углы)
- **`get(t)`** — функция, возвращающая точку `(x, z)` на стене при параметре `t ∈ [0, 1]`
- **`wallIndex`** — индекс стены (0-3) для определения направления смещения
- **`rotate90`** — нужно ли повернуть кирпич на 90° (для стен вдоль X)

### Вычисление периметра
```js
perimeter = segs.reduce((sum, s) => sum + s.len, 0)
```

### Массив концов сегментов
```js
segEnds = []  // накопленные концы сегментов
let acc = 0
for (let s = 0; s < segs.length; s++) {
  if (segs[s].len > 0) acc += segs[s].len
  segEnds.push(acc)
}
```

### Количество кирпичей в одном круге
```js
bricksPerLap = perimeter > 1e-6 
  ? Math.max(1, Math.floor(perimeter / step)) 
  : n
```

---

## Шаг 4: Вспомогательные функции навигации

### `pointAtDistance(dist)`
По расстоянию вдоль периметра находит точку на траектории:
```js
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
```

### `getSegmentIndex(dist)`
Определяет, на каком сегменте находится расстояние:
```js
function getSegmentIndex(dist) {
  const d = perimeter > 1e-6 ? dist % perimeter : 0
  for (let s = 0; s < segEnds.length; s++) {
    if (d < segEnds[s]) return s
  }
  return segEnds.length - 1
}
```

### `getCornerDist(dist)`
Вычисляет расстояние до физического угла (с учётом половины кирпича):
```js
function getCornerDist(dist) {
  const s = getSegmentIndex(dist)
  const ext = (s === 0 || s === 2) ? halfL : halfW
  return segEnds[s] + ext
}
```

### `getPrevSegmentCornerDist(segIndex)`
Расстояние до угла предыдущего сегмента (для стыковки замыкающих кирпичей):
```js
function getPrevSegmentCornerDist(segIndex) {
  if (segIndex <= 0) return 0
  const ext = (segIndex === 1 || segIndex === 3) ? halfL : halfW
  return segEnds[segIndex - 1] + ext
}
```

---

## Шаг 5: Основной цикл создания кирпичей

```js
for (let i = 0; i < n; i++) {
  // ... создание кирпича номер i+1
}
```

### 5.1. Определение ряда и позиции

```js
row = Math.floor(i / bricksPerLap)           // номер ряда (0, 1, 2, ...)
posInLap = i % bricksPerLap                  // позиция в текущем круге
offsetForRow = (row % 2) * halfBrickAlongPath  // смещение для нечётных рядов
```

**Смещение рядов:** Нечётные ряды смещаются на полкирпича для разбежки швов (как в реальной кладке).

### 5.2. Расстояние вдоль периметра

```js
dist = (offsetForRow + posInLap * step) % (perimeter || 1)
```

### 5.3. Высота кирпича

```js
y = row * (brickH + closureGapM) + brickH / 2
```

Минимальный зазор между рядами (`closureGapM`) обеспечивает, что замыкающие кирпичи не пересекаются со следующим рядом.

### 5.4. Определение сегмента и угла

```js
segmentEnd = getSegmentEnd(dist)
segIndex = getSegmentIndex(dist)
cornerDist = getCornerDist(dist)
```

---

## Шаг 6: Обработка углов и замыкающих кирпичей

### 6.1. Проверка предыдущего кирпича (если мы первый в новом сегменте)

Если текущий кирпич — первый в сегменте после угла, проверяем, был ли предыдущий кирпич замыкающим:

```js
if (segIndex > 0) {
  posInLapPrev = posInLap === 0 ? bricksPerLap - 1 : posInLap - 1
  distPrev = (offsetForRow + posInLapPrev * step) % (perimeter || 1)
  
  if (distPrev < segEnds[segIndex - 1]) {
    // Предыдущий кирпич был на предыдущем сегменте
    cornerDistPrev = getPrevSegmentCornerDist(segIndex)
    distFromEdgePrev = cornerDistPrev - (distPrev + halfExtent)
    prevWasClosure = distFromEdgePrev > 1e-6 && distFromEdgePrev < brickAlongPath
    
    if (prevWasClosure && dist - halfExtentCurrent < cornerDistPrev) {
      // Сдвигаем текущий кирпич за угол, чтобы не пересекаться
      dist = cornerDistPrev + halfExtentCurrent + closureGapM
    }
  }
}
```

### 6.2. Определение необходимости замыкающего кирпича

```js
halfExtentSeg = (segIndex === 0 || segIndex === 2) 
  ? halfL * brickMargin 
  : halfW * brickMargin

distFromEdgeToCorner = cornerDist - (dist + halfExtentSeg)
brickExtentSeg = (segIndex === 0 || segIndex === 2) ? brickL : brickW

needClosure = distFromEdgeToCorner > 1e-6 && distFromEdgeToCorner < brickExtentSeg
```

**Условие:** Кирпич становится замыкающим, если его край не достаёт до угла, но расстояние меньше длины целого кирпича.

### 6.3. Вычисление длины замыкающего кирпича

```js
closureLenM = needClosure 
  ? Math.min(cornerDist - (dist - halfExtentSeg), 2 * brickAlongPath) 
  : null

closureLen = closureLenM != null ? closureLenM / brickMargin : null
```

Длина ограничена максимумом в 2 стандартных кирпича (на случай ошибок вычислений).

### 6.4. Позиция центра кирпича

```js
posDist = needClosure 
  ? (dist - halfExtentSeg + cornerDist) / 2  // середина между началом и углом
  : dist                                      // обычная позиция
```

Для замыкающего кирпича центр размещается посередине между началом кирпича и углом.

### 6.5. Получение точки на траектории

```js
pt = pointAtDistance(posDist)  // { x, z, wallIndex, rotate90 }
```

---

## Шаг 7: Создание 3D-меша кирпича

### 7.1. Геометрия

```js
if (closureLen != null) {
  // Замыкающий кирпич — создаём новую геометрию
  geom = new THREE.BoxGeometry(brickW, brickH, closureLen)
  closureGeometries.push(geom)  // для последующего dispose
} else {
  // Обычный кирпич — используем общую геометрию
  geom = lastBrickGeometry  // BoxGeometry(brickW, brickH, brickL)
}
```

### 7.2. Материал

```js
mat = needClosure ? closureBrickMaterial : lastBrickMaterial
lineMat = needClosure ? closureBrickLineMaterial : lastLineMaterial
```

- **Обычный кирпич:** оранжево-красный (`brickColor = 0xc75c3d`)
- **Замыкающий кирпич:** красный (`closureBrickColor = 0xff0000`)

### 7.3. Создание меша

```js
mesh = new THREE.Mesh(geom, mat)
mesh.scale.set(brickMargin, brickMargin, brickMargin)  // визуальный зазор ~3%
mesh.castShadow = true
mesh.receiveShadow = true
```

### 7.4. Контур (рёбра)

```js
edgesGeom = geom === lastBrickGeometry 
  ? lastEdgesGeometry  // общая геометрия рёбер
  : new THREE.EdgesGeometry(geom)  // новая для замыкающего

mesh.add(new THREE.LineSegments(edgesGeom, lineMat))
```

### 7.5. Подпись-номер

```js
labelDiv = document.createElement('div')
labelDiv.className = needClosure ? 'brick-label brick-label-closure' : 'brick-label'
labelDiv.textContent = i + 1
labelDiv.style.fontSize = `${baseFontSize}px`

labelObj = new CSS2DObject(labelDiv)
labelObj.position.set(0, 0, 0)
labelObj.center.set(0.5, 0.5)
mesh.add(labelObj)
```

### 7.6. Метаданные кирпича

```js
mesh.userData = {
  number: i + 1,
  wallIndex: pt.wallIndex,
  row: row,
  labelEl: labelDiv,
  labelObj: labelObj,
  isClosure: needClosure,
  closureLengthMm: closureLenM != null ? Math.round(closureLenM * 1000) : null
}
```

### 7.7. Поворот кирпича

```js
if (pt.rotate90) {
  mesh.rotation.y = Math.PI / 2  // поворот на 90° для стен вдоль X
}
```

---

## Шаг 8: Смещение внутрь от края и финальная позиция

Траектория идёт **по самому краю** фундамента, поэтому центр кирпича нужно сместить **внутрь** дома на половину толщины кирпича.

### 8.1. Вычисление смещений

```js
halfExtX = (pt.wallIndex === 1 || pt.wallIndex === 3) 
  ? halfW * brickMargin 
  : 0

halfExtZ = (pt.wallIndex === 0 || pt.wallIndex === 2) 
  ? halfW * brickMargin 
  : 0

dx = (pt.wallIndex === 1 ? -halfExtX : pt.wallIndex === 3 ? halfExtX : 0)
dz = (pt.wallIndex === 0 ? halfExtZ : pt.wallIndex === 2 ? -halfExtZ : 0)
```

**Логика:**
- Стены 0 и 2 (вдоль X): смещение по Z
- Стены 1 и 3 (вдоль Z): смещение по X
- Направление зависит от `wallIndex` (внутрь дома)

### 8.2. Установка финальной позиции

```js
mesh.position.set(pt.x + dx, y, pt.z + dz)
wallsGroup.add(mesh)
```

---

## Итоговый результат

После выполнения цикла получаем:
- **N кирпичей**, распределённых по периметру
- **Несколько рядов** (если `N > bricksPerLap`)
- **Чередование рядов** (смещение на полкирпича)
- **Замыкающие кирпичи** на углах (красные, обрезанные)
- **Минимальные зазоры** между кирпичами и рядами
- **Правильное смещение** внутрь от края фундамента

---

## Пример расчёта

**Входные данные:**
- Дом: `houseLength = 10 м`, `houseWidth = 8 м`
- Кирпич: `brickWidth = 500 мм`, `brickLength = 625 мм`, `brickHeight = 250 мм`
- Зазор: `brickGap = 2 мм`
- Количество: `distributionBrickCount = 20`

**Шаг 1: Конвертация**
```
L = 5 м, W = 4 м
brickW = 0.5 м, brickL = 0.625 м, brickH = 0.25 м
gapM = 0.002 м
```

**Шаг 2: Параметры распределения**
```
brickAlongPath = max(0.5, 0.625) = 0.625 м
halfExtent = 0.625 * 0.97 / 2 ≈ 0.303 м
step = 0.625 * 0.97 + 0.002 ≈ 0.608 м
```

**Шаг 3: Траектория**
```
segs[0].len = 2*5 - 0.625 = 9.375 м (передняя)
segs[1].len = 2*4 - 0.5 = 7.5 м (правая)
segs[2].len = 9.375 м (задняя)
segs[3].len = 7.5 м (левая)
perimeter = 33.75 м
```

**Шаг 4: Количество в круге**
```
bricksPerLap = floor(33.75 / 0.608) ≈ 55 кирпичей
```

**Шаг 5: Для кирпича i=0 (первый)**
```
row = 0
posInLap = 0
offsetForRow = 0
dist = 0 * 0.608 = 0 м
y = 0 * (0.25 + 0.003) + 0.25/2 = 0.125 м
```

Кирпич размещается в начале передней стены (x ≈ -4.6875, z = -4), смещён внутрь на `halfW * brickMargin ≈ 0.2425 м` по Z.

---

## Особенности алгоритма

1. **Эффективность памяти:** Общая геометрия и материал переиспользуются для всех обычных кирпичей
2. **Точность углов:** Замыкающие кирпичи точно заполняют углы без пересечений
3. **Визуальная реалистичность:** Чередование рядов имитирует реальную кладку
4. **Гибкость:** Работает для любого количества кирпичей и размеров дома
