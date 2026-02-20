/**
 * Добавляет в public/history.md последние N коммитов из git, которых ещё нет в таблице.
 * Так в таблице появятся «старые» коммиты, а не только те, после которых запускали commit-history.
 * Запуск: node scripts/import-git-history.cjs [N]
 * По умолчанию N = 50.
 */
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')
const filePath = path.join(root, 'public', 'history.md')
const limit = Math.min(parseInt(process.argv[2], 10) || 50, 200)

if (!fs.existsSync(filePath)) {
  console.log('Файл public/history.md не найден.')
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf-8')
const lines = content.split(/\r?\n/)

const existingHashes = new Set()
const sepLike = /^\|[\s\-|]+\|$/
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!line.startsWith('|') || sepLike.test(line.trim())) continue
  const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
  if (cells.length >= 3 && cells[0] !== 'Дата') {
    const hash = cells[2]
    if (hash && hash !== '—') existingHashes.add(hash)
  }
}

function escapeCell(s) {
  return String(s || '').replace(/\|/g, ',').trim() || '—'
}

/** Пытается исправить кракозябры: сообщение в репо могло быть сохранено в CP1251. */
function fixMessageEncoding(msg) {
  if (!msg || msg.length === 0) return msg
  try {
    const fixed = Buffer.from(msg, 'utf8').toString('cp1251')
    if (fixed.includes('\uFFFD') || fixed.length !== msg.length) return msg
    const looksLikeMojibake = /Рґ|Рѕ|СЂ|Рє|С‹|Рї|СЏ|Р»|Рё|РЅ|Р°|Р±|РІ|Рі|Рµ|С‚/.test(msg)
    const looksLikeRussian = /[а-яёА-ЯЁ]{2,}/.test(fixed)
    if (looksLikeMojibake && looksLikeRussian) return fixed
  } catch (_) {}
  return msg
}

const gitEnv = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }

let newRows = []
try {
  const out = execSync(`git -c i18n.logOutputEncoding=UTF-8 log -n ${limit} --format="%h|%ci|%s"`, { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024, env: gitEnv })
  const seen = new Set()
  out.trim().split('\n').forEach((line) => {
    const parts = line.split('|')
    if (parts.length < 3) return
    const hash = parts[0].trim()
    const dateStr = parts[1].trim()
    let msg = escapeCell(parts.slice(2).join('|'))
    msg = fixMessageEncoding(msg)
    if (existingHashes.has(hash) || seen.has(hash)) return
    seen.add(hash)
    let d = new Date()
    if (dateStr) {
      const iso = dateStr.replace(' ', 'T').replace(/\s*([+-])(\d{2})(\d{2})$/, '$1$2:$3')
      const parsed = new Date(iso)
      if (!Number.isNaN(parsed.getTime())) d = parsed
    }
    const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const gitCommand = `git checkout ${hash}`
    newRows.push(`| ${date} | ${time} | ${hash} | ${msg} | коммит | ${gitCommand} |`)
  })
} catch (e) {
  console.error('Ошибка чтения git log:', e.message)
  process.exit(1)
}

if (newRows.length === 0) {
  console.log('Нет новых коммитов для добавления (все уже в таблице).')
  process.exit(0)
}

const headerEnd = lines.findIndex((l) => sepLike.test(l.trim()))
const insertAt = headerEnd >= 0 ? headerEnd + 1 : 2
const before = lines.slice(0, insertAt).join('\n')
const after = lines.slice(insertAt).join('\n')
const newContent = before + '\n' + newRows.join('\n') + (after ? '\n' + after : '')
fs.writeFileSync(filePath, newContent, 'utf-8')
console.log(`Добавлено коммитов в history.md: ${newRows.length}`)
