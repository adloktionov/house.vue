<template>
  <div class="history-panel">
    <div class="history-panel__table-wrap">
      <h3 class="history-panel__title">История: коммиты, билды, деплои</h3>
      <template v-for="(rows, monthKey) in byMonth" :key="monthKey">
        <h4 class="history-panel__month">{{ monthTitle(monthKey) }}</h4>
        <table class="history-panel__table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Время</th>
              <th>Текст коммита</th>
              <th>Тип</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in rows"
              :key="monthKey + i"
              :class="rowTypeClass(row.type)"
            >
              <td>{{ row.date }}</td>
              <td>{{ row.time }}</td>
              <td>{{ row.message }}</td>
              <td>{{ row.type }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <p v-if="!entries.length && !loading" class="history-panel__empty">Нет записей. Запустите commit-history, build или deploy.</p>
      <p v-if="loading" class="history-panel__loading">Загрузка…</p>
    </div>
    <div class="history-panel__right">
      <label class="history-panel__label">
        Выбор дня:
        <input
          v-model="selectedDateStr"
          type="date"
          class="history-panel__input"
        />
      </label>
      <div class="history-panel__calendar">
        <div class="history-panel__calendar-header">
          <button type="button" class="history-panel__cal-btn" @click="prevMonth">‹</button>
          <span class="history-panel__cal-month">{{ calendarTitle }}</span>
          <button type="button" class="history-panel__cal-btn" @click="nextMonth">›</button>
        </div>
        <div class="history-panel__calendar-weekdays">
          <span v-for="w in weekdays" :key="w" class="history-panel__weekday">{{ w }}</span>
        </div>
        <div class="history-panel__calendar-days">
          <template v-for="(day, idx) in calendarDays" :key="idx">
            <span v-if="day === null" class="history-panel__day history-panel__day_empty" />
            <button
              v-else
              type="button"
              :class="['history-panel__day', dayClasses(day)]"
              @click="selectDay(day)"
            >
              {{ day.getDate() }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const loading = ref(true)
const rawText = ref('')
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const calendarYear = ref(new Date().getFullYear())
const calendarMonth = ref(new Date().getMonth())
const selectedDateStr = ref('')

function parseMdTable(text) {
  const lines = text.trim().split(/\r?\n/)
  const rows = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|') || line === '|------|-------|---------------|-----|') continue
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length >= 4 && cells[0] !== 'Дата') {
      rows.push({
        date: cells[0],
        time: cells[1],
        message: cells[2],
        type: cells[3],
      })
    }
  }
  return rows
}

const entries = computed(() => parseMdTable(rawText.value))

const byMonth = computed(() => {
  const map = {}
  for (const row of entries.value) {
    const [d, m, y] = row.date.split('.')
    const key = `${y}-${m}`
    if (!map[key]) map[key] = []
    map[key].push(row)
  }
  const keys = Object.keys(map).sort((a, b) => b.localeCompare(a))
  const out = {}
  keys.forEach((k) => { out[k] = map[k] })
  return out
})

function monthTitle(key) {
  const [y, m] = key.split('-')
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

function rowTypeClass(type) {
  const t = (type || '').toLowerCase()
  if (t === 'коммит') return 'history-panel__row_commit'
  if (t === 'билд') return 'history-panel__row_build'
  if (t === 'деплой') return 'history-panel__row_deploy'
  return ''
}

function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}.${m}.${y}`
}

const eventsByDate = computed(() => {
  const map = {}
  for (const row of entries.value) {
    const key = row.date
    if (!map[key]) map[key] = { commit: false, build: false, deploy: false }
    const t = (row.type || '').toLowerCase()
    if (t === 'коммит') map[key].commit = true
    if (t === 'билд') map[key].build = true
    if (t === 'деплой') map[key].deploy = true
  }
  return map
})

function dayClasses(day) {
  const key = dateKey(day)
  const ev = eventsByDate.value[key] || {}
  const c = []
  if (ev.deploy) c.push('history-panel__day_deploy')
  else if (ev.build) c.push('history-panel__day_build')
  else if (ev.commit) c.push('history-panel__day_commit')
  if (selectedDateStr.value === dayToInputValue(day)) c.push('history-panel__day_selected')
  return c
}

function dayToInputValue(day) {
  const y = day.getFullYear()
  const m = String(day.getMonth() + 1).padStart(2, '0')
  const d = String(day.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const calendarTitle = computed(() => {
  const d = new Date(calendarYear.value, calendarMonth.value, 1)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
})

const calendarDays = computed(() => {
  const first = new Date(calendarYear.value, calendarMonth.value, 1)
  const last = new Date(calendarYear.value, calendarMonth.value + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startDow; i++) days.push(null)
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(calendarYear.value, calendarMonth.value, d))
  }
  return days
})

function prevMonth() {
  if (calendarMonth.value === 0) {
    calendarMonth.value = 11
    calendarYear.value--
  } else {
    calendarMonth.value--
  }
}

function nextMonth() {
  if (calendarMonth.value === 11) {
    calendarMonth.value = 0
    calendarYear.value++
  } else {
    calendarMonth.value++
  }
}

function selectDay(day) {
  selectedDateStr.value = dayToInputValue(day)
}

onMounted(() => {
  fetch('/history.md')
    .then((r) => r.ok ? r.text() : '')
    .then((text) => {
      rawText.value = text || ''
      loading.value = false
    })
    .catch(() => { loading.value = false })
})
</script>

<style scoped>
.history-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.25);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  align-items: flex-start;
}

.history-panel__table-wrap {
  flex: 1;
  min-width: 280px;
}

.history-panel__title {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #e0e6ec;
}

.history-panel__month {
  font-size: 0.9rem;
  color: #a0a8b0;
  margin: 0.75rem 0 0.25rem;
}

.history-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.history-panel__table th,
.history-panel__table td {
  padding: 0.35rem 0.5rem;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.history-panel__table th {
  background: rgba(255, 255, 255, 0.06);
  color: #b0b8c0;
}

.history-panel__table td {
  color: #d0d8e0;
}

.history-panel__row_commit { background: rgba(255, 193, 7, 0.12); }
.history-panel__row_build  { background: rgba(76, 175, 80, 0.12); }
.history-panel__row_deploy { background: rgba(33, 150, 243, 0.12); }

.history-panel__empty,
.history-panel__loading {
  color: #808890;
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.history-panel__right {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 200px;
}

.history-panel__label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  color: #b0b8c0;
  font-size: 0.85rem;
}

.history-panel__input {
  padding: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 0.9rem;
}

.history-panel__calendar {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-panel__calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.history-panel__cal-month {
  font-size: 0.9rem;
  color: #e0e6ec;
}

.history-panel__cal-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

.history-panel__cal-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.history-panel__calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
  font-size: 0.7rem;
  color: #808890;
}

.history-panel__weekday {
  text-align: center;
}

.history-panel__calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.history-panel__day {
  aspect-ratio: 1;
  max-width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c0c8d0;
  font-size: 0.8rem;
  cursor: pointer;
}

.history-panel__day_empty {
  cursor: default;
}

.history-panel__day:hover:not(.history-panel__day_empty) {
  background: rgba(255, 255, 255, 0.15);
}

.history-panel__day_commit { background: rgba(255, 193, 7, 0.35); color: #1a1a1a; }
.history-panel__day_build  { background: rgba(76, 175, 80, 0.35); color: #fff; }
.history-panel__day_deploy { background: rgba(33, 150, 243, 0.35); color: #fff; }

.history-panel__day_selected {
  outline: 2px solid #fff;
  outline-offset: 1px;
}
</style>
