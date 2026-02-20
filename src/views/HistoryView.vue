<template>
  <div class="history-view">
    <header class="history-view__header">
      <h1>История: коммиты, билды, деплои</h1>
      <p class="history-view__sub">Таблица и календарь по <code>history.md</code></p>
    </header>
    <HistoryPanel />
  </div>
</template>

<script setup>
import HistoryPanel from '../components/HistoryPanel.vue'
</script>

<style scoped>
.history-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #e8e8e8;
}

.history-view__header {
  text-align: center;
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.history-view__header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.history-view__sub {
  font-size: 0.9rem;
  opacity: 0.85;
}

.history-view__sub code {
  padding: 0.1em 0.35em;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 0.9em;
}
</style>
