import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'calculator',
    component: () => import('../views/CalculatorView.vue'),
    meta: { title: 'Калькулятор кирпичей' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryView.vue'),
    meta: { title: 'История: коммиты, билды, деплои' },
  },
  {
    path: '/bin-packing',
    name: 'bin-packing',
    component: () => import('../views/BinPackingView.vue'),
    meta: { title: 'Bin Packing Problem' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — Калькулятор кирпичей` : 'Калькулятор кирпичей'
})

export default router
