import Vue from 'vue'
import VueRouter from 'vue-router'
import HomePage from '../views/HomePage.vue'
import BookingPage from '../views/BookingPage.vue'
import MemberCenter from '../views/MemberCenter.vue'
import AdminDashboard from '../views/AdminDashboard.vue'

Vue.use(VueRouter)

export default new VueRouter({
  mode: 'hash',
  scrollBehavior () {
    return { x: 0, y: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/booking', name: 'booking', component: BookingPage },
    { path: '/member', name: 'member', component: MemberCenter },
    { path: '/admin', name: 'admin', component: AdminDashboard },
    { path: '*', redirect: '/' }
  ]
})
