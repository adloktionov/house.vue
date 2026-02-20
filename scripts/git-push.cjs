/**
 * git add -A, git commit -m "...", git push origin <текущая ветка>
 * Вызов: node scripts/git-push.cjs [сообщение коммита]
 * Или:   npm run push
 *        npm run push -- "сообщение коммита"
 */
const { execSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')
const msg = process.argv[2] && process.argv[2].trim() || 'update'

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts })
}

try {
  run('git add -A')
  run(`git commit -m ${JSON.stringify(msg)}`)
  const branch = execSync('git branch --show-current', { cwd: root, encoding: 'utf-8' }).trim()
  run(`git push origin ${branch}`)
  console.log('Готово: add, commit, push.')
} catch (e) {
  process.exitCode = e.status ?? 1
}
