import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function historyRefreshPlugin() {
  return {
    name: 'history-refresh',
    configureServer(server) {
      server.middlewares.use('/api/refresh-history', (req, res) => {
        if (req.method !== 'GET' && req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        try {
          execSync('node scripts/import-git-history.cjs', { cwd: __dirname, encoding: 'utf-8', stdio: 'pipe' })
        } catch (_) {}
        try {
          execSync('node scripts/backfill-history-commits.cjs', { cwd: __dirname, encoding: 'utf-8', stdio: 'pipe' })
        } catch (_) {}
        const filePath = path.join(__dirname, 'public', 'history.md')
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : ''
        res.statusCode = 200
        res.end(content)
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), historyRefreshPlugin()],
})
