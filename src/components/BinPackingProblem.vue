<template>
  <div class="bin-packing-problem">
    <h2 class="bin-packing-problem__title">классическая NP-полная задача</h2>
    <div class="bin-packing-problem__content" v-html="htmlContent"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { marked } from 'marked'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const htmlContent = ref('')

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
    const res = await fetch('/bin-packing.md')
    const md = await res.text()
    const rawHtml = await marked.parse(md ?? '')
    htmlContent.value = renderMath(rawHtml)
  } catch {
    htmlContent.value = '<p>Не удалось загрузить текст.</p>'
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
</style>
