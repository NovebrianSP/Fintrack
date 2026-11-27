import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

for (let index = localStorage.length - 1; index >= 0; index -= 1) {
  const key = localStorage.key(index)
  if (key?.startsWith('fintrack-demo-')) localStorage.removeItem(key)
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
