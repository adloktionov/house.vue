<template>
  <div class="results-table">
    <h3>Результаты расчёта</h3>
    <table>
      <thead>
        <tr>
          <th>Кирпичей в ряду</th>
          <th>Рядов</th>
          <th>Общее кол-во</th>
          <th>Высота стен (м)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ bricksPerRow }}</td>
          <td>{{ rows }}</td>
          <td><strong>{{ totalBricks }}</strong></td>
          <td>{{ wallHeight.toFixed(2) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  bricksPerRow: { type: Number, required: true },
  rows: { type: Number, required: true },
  totalBricks: { type: Number, required: true },
  wallHeight: { type: Number, required: true },
})
</script>

<style scoped>
.results-table {
  max-width: 800px;
  margin: 0 auto;
}

.results-table h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #a0c4ff;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

th,
td {
  padding: 0.75rem 1rem;
  text-align: left;
}

th {
  background: rgba(160, 196, 255, 0.15);
  font-weight: 600;
  font-size: 0.9rem;
}

td {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

td strong {
  color: #a0c4ff;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  table {
    font-size: 0.85rem;
  }
  th,
  td {
    padding: 0.5rem 0.75rem;
  }
}
</style>
