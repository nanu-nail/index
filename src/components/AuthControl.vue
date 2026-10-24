<template>
  <div class="auth-control">
    <span v-if="authState.loading" class="auth-loading">確認登入狀態…</span>
    <button v-else-if="!authState.user" class="auth-login" type="button" @click="login">
      Google 登入
    </button>
    <div v-else class="auth-signed-in">
      <router-link v-if="showProfile" class="auth-profile" to="/member" :title="(authState.memberProfile && authState.memberProfile.customerName) || '會員中心'">
        <img v-if="authState.user.photoURL" :src="authState.user.photoURL" alt="" referrerpolicy="no-referrer">
        <span>{{ (authState.memberProfile && authState.memberProfile.customerName) || '設定會員資料' }}</span>
      </router-link>
      <button class="auth-logout" type="button" @click="logout">登出</button>
    </div>
    <p v-if="error || authState.error" class="auth-error" role="alert">{{ error || authState.error }}</p>
  </div>
</template>

<script>
import { authState, signInWithGoogle, signOutCurrentUser } from '../services/auth'

export default {
  name: 'AuthControl',
  props: {
    showProfile: { type: Boolean, default: true }
  },
  data () {
    return { authState, error: '' }
  },
  methods: {
    async login () {
      this.error = ''
      try {
        await signInWithGoogle()
      } catch (error) {
        this.error = error.message || '登入失敗，請稍後重試。'
      }
    },
    async logout () {
      this.error = ''
      try {
        await signOutCurrentUser()
      } catch (error) {
        this.error = '登出失敗，請稍後重試。'
      }
    }
  }
}
</script>

<style scoped>
.auth-control{font-size:14.666px}
.auth-loading{color:var(--muted);white-space:nowrap}
.auth-login,.auth-logout{padding:0;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.auth-login span{margin-left:6px}
.auth-signed-in,.auth-profile{display:flex;align-items:center;gap:9px}
.auth-profile{max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.auth-profile img{width:28px;height:28px;border-radius:50%;object-fit:cover}
.auth-logout{color:var(--muted);font-size:13.666px}
.auth-error{max-width:260px;margin:8px 0;color:#9b5145;font-size:13.666px;line-height:1.6}
</style>
