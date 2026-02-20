<template>
  <div class="app">
    <nav class="app-nav">
      <router-link to="/" class="app-nav__link" active-class="app-nav__link_active">Калькулятор</router-link>
      <router-link to="/history" class="app-nav__link" active-class="app-nav__link_active">История</router-link>
      <router-link to="/bin-packing" class="app-nav__link" active-class="app-nav__link_active">Bin Packing</router-link>
    </nav>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e8e8e8;
}

.app-nav {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.app-nav__link {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  color: #b0b8c0;
  text-decoration: none;
  font-size: 0.95rem;
  transition: background 0.2s, color 0.2s;
}

.app-nav__link:hover {
  color: #e0e6ec;
  background: rgba(255, 255, 255, 0.08);
}

.app-nav__link_active {
  color: #fff;
  background: rgba(33, 150, 243, 0.25);
}

.app-main {
  flex: 1;
}
</style>
