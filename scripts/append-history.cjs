/**
 * Дописывает строку в history.md (таблица: Дата | Время | Текст коммита | Тип).
 * Вызов: node scripts/append-history.cjs <commit|build|deploy> [путь к history.md]
 * Для commit запись идёт в public/history.md; для build/deploy — в dist/history.md (путь можно передать вторым аргументом).
 */
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const type = process.argv[2] || ''
const customPath = process.argv[3]

const root = path.join(__dirname, '..')
const publicPath = path.join(root, 'public', 'history.md')
const distPath = path.join(root, 'dist', 'history.md')

let targetPath = customPath
if (!targetPath) {
  targetPath = type === 'commit' ? publicPath : distPath
}

function now() {
  const d = new Date()
  const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return { date, time }
}

function escapeCell(s) {
  return String(s || '').replace(/\|/g, ',').trim() || '—'
}

function getCommitRow() {
  try {
    const dateStr = execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim()
    const msg = execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim()
    let d = new Date()
    if (dateStr) {
      const iso = dateStr.replace(' ', 'T').replace(/\s*([+-])(\d{2})(\d{2})$/, '$1$2:$3')
      const parsed = new Date(iso)
      if (!Number.isNaN(parsed.getTime())) d = parsed
    }
    const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    return { date, time, msg: escapeCell(msg) }
  } catch {
    const { date, time } = now()
    return { date, time, msg: '—' }
  }
}

const types = { commit: 'коммит', build: 'билд', deploy: 'деплой' }
const typeLabel = types[type] || type || '—'

let date, time, msg
if (type === 'commit') {
  const row = getCommitRow()
  date = row.date
  time = row.time
  msg = row.msg
} else {
  const n = now()
  date = n.date
  time = n.time
  msg = '—'
}

const line = `| ${date} | ${time} | ${msg} | ${typeLabel} |\n`

if (type === 'build' && !fs.existsSync(path.join(root, 'dist'))) {
  console.log('Папка dist не найдена, пропуск записи билда в history.md')
  process.exit(0)
}

const dir = path.dirname(targetPath)
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true })
}

let content = ''
if (fs.existsSync(targetPath)) {
  content = fs.readFileSync(targetPath, 'utf-8')
} else {
  content = `| Дата | Время | Текст коммита | Тип |\n|------|-------|---------------|-----|\n`
}

fs.writeFileSync(targetPath, content + line, 'utf-8')
console.log(`Добавлена запись в ${targetPath}: ${typeLabel} ${date} ${time}`)
