<template>
  <div class="bin-packing-problem">
    <template v-if="loading">
      <div class="bin-packing-problem__loading">
        <p class="bin-packing-problem__loading-text">загрузка задачи</p>
        <div class="bin-packing-problem__preloader">
          <div class="bin-packing-problem__preloader-fill"></div>
        </div>
      </div>
    </template>
    <template v-else>
      <h2 class="bin-packing-problem__title">классическая NP-полная задача</h2>
      <div class="bin-packing-problem__content" v-html="htmlContent"></div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import mdRaw from '../content/bin-packing.md?raw'

const htmlContent = ref('')
const loading = ref(true)

/** Декодирует HTML-сущности в строке формулы (marked экранирует < и >). */
function decodeFormula(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
}

/** Подставляет в HTML рендер KaTeX для формул \( ... \) и \[ ... \]. */
function renderMath(html) {
  if (!html) return html
  let out = html
  // Блочные формулы \[ ... \]
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, formula) => {
    try {
      const f = decodeFormula(formula.trim())
      return katex.renderToString(f, { displayMode: true, throwOnError: false })
    } catch {
      return `<span class="math-error">${formula}</span>`
    }
  })
  // Строчные формулы \( ... \)
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, formula) => {
    try {
      const f = decodeFormula(formula.trim())
      return katex.renderToString(f, { displayMode: false, throwOnError: false })
    } catch {
      return `<span class="math-error">${formula}</span>`
    }
  })
  return out
}

onMounted(async () => {
  try {
    const rawHtml = await marked.parse(mdRaw ?? '')
    htmlContent.value = renderMath(rawHtml)
  } catch {
    htmlContent.value = '<p>Не удалось загрузить текст.</p>'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.bin-packing-problem {
  padding: 1rem 1.5rem;
  color: #e8e8e8;
}

.bin-packing-problem__title {
  font-size: 1.35rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.bin-packing-problem__content {
  line-height: 1.6;
}

.bin-packing-problem__content :deep(p) { margin: 0.5em 0; }
.bin-packing-problem__content :deep(ul), .bin-packing-problem__content :deep(ol) { margin: 0.5em 0; padding-left: 1.5em; }
.bin-packing-problem__content :deep(h3) { font-size: 1.1rem; margin: 1em 0 0.5em; }
.bin-packing-problem__content :deep(a) { color: #64b5f6; }
.bin-packing-problem__content :deep(pre) { background: rgba(0,0,0,0.25); padding: 1rem; border-radius: 8px; overflow-x: auto; }
.bin-packing-problem__content :deep(code) { font-family: ui-monospace, monospace; font-size: 0.9em; }
.bin-packing-problem__content :deep(.katex) { font-size: 1.05em; }
.bin-packing-problem__content :deep(.katex-display) { margin: 0.75em 0; overflow-x: auto; overflow-y: hidden; text-align: center; }
.bin-packing-problem__content :deep(.math-error) { color: #f48fb1; }

.bin-packing-problem__loading {
  padding: 2rem 1.5rem;
  text-align: center;
}

.bin-packing-problem__loading-text {
  font-size: 1.1rem;
  color: #b0b8c0;
  margin-bottom: 1.25rem;
}

.bin-packing-problem__preloader {
  width: 100%;
  max-width: 280px;
  height: 6px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}

.bin-packing-problem__preloader-fill {
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, #64b5f6, #90caf9);
  border-radius: 3px;
  animation: bin-packing-fill 1.2s ease-in-out infinite;
}

@keyframes bin-packing-fill {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(250%); }
  100% { transform: translateX(-100%); }
}
</style>
