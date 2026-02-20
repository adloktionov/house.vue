/**
 * Один раз заполняет пустые «ID коммита» и «Команда отката» в public/history.md
 * для строк типа «коммит», ища коммит в git по тексту сообщения.
 * Запуск: node scripts/backfill-history-commits.cjs
 */
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const root = path.join(__dirname, '..')
const filePath = path.join(root, 'public', 'history.md')

if (!fs.existsSync(filePath)) {
  console.log('Файл public/history.md не найден.')
  process.exit(0)
}

let content = fs.readFileSync(filePath, 'utf-8')
const lines = content.split(/\r?\n/)

const gitEnv = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }

function getCommitHashesByMessage() {
  try {
    const out = execSync('git -c i18n.logOutputEncoding=UTF-8 log --all --format="%h|%s"', { encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024, env: gitEnv })
    const map = {}
    out.trim().split('\n').forEach((line) => {
      const i = line.indexOf('|')
      if (i > 0) {
        const hash = line.slice(0, i).trim()
        const msg = line.slice(i + 1).trim().replace(/\|/g, ',')
        if (!map[msg]) map[msg] = hash
      }
    })
    return map
  } catch {
    return {}
  }
}

const hashByMessage = getCommitHashesByMessage()

let changed = false
const newLines = lines.map((line) => {
  if (!line.startsWith('|') || line.includes('Дата') || /^\|[\s\-|]+\|$/.test(line.trim())) return line
  const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
  if (cells.length < 6) return line
  const [date, time, commitId, message, type, gitCommand] = cells
  if ((type || '').toLowerCase() !== 'коммит') return line
  if (commitId && commitId !== '—') return line
  const hash = hashByMessage[message] || hashByMessage[message.trim()]
  if (!hash) return line
  const cmd = `git checkout ${hash}`
  changed = true
  return `| ${date} | ${time} | ${hash} | ${message} | ${type} | ${cmd} |`
})

if (changed) {
  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8')
  console.log('Обновлены ID коммитов и команды отката в public/history.md')
} else {
  console.log('Нет строк для обновления или коммиты не найдены по тексту.')
}
