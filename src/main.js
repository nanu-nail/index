import Vue from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'
import { initializeAuth } from './services/auth'

Vue.config.productionTip = false
initializeAuth()

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
