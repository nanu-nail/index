<template>
  <div class="profile-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title">
    <form class="profile-card" @submit.prevent="save">
      <p class="eyebrow">MEMBER PROFILE</p>
      <h2 id="profile-title">完成會員資料</h2>
      <p class="description">首次登入請填寫姓名與手機，這些資料會用於預約聯絡，完成後無法自行修改。</p>
      <label>姓名<input v-model.trim="customerName" type="text" autocomplete="name" maxlength="60" required></label>
      <label>手機號碼<input v-model.trim="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10" placeholder="09XXXXXXXX" required></label>
      <PageNotice v-if="error" tone="warning">{{ error }}</PageNotice>
      <button class="button button-dark" type="submit" :disabled="saving">{{ saving ? '儲存中…' : '完成設定' }}</button>
    </form>
  </div>
</template>

<script>
import PageNotice from './PageNotice.vue'
import { authState, saveMemberProfile } from '../services/auth'

export default {
  name: 'MemberProfileSetup',
  components: { PageNotice },
  data () {
    return { customerName: '', phone: '', saving: false, error: '' }
  },
  methods: {
    async save () {
      this.error = ''
      this.saving = true
      try {
        await saveMemberProfile(authState.user, this.customerName, this.phone)
      } catch (error) {
        this.error = error.message || '會員資料儲存失敗，請稍後再試。'
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.profile-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(39,33,30,.55)}
.profile-card{width:min(440px,100%);max-height:calc(100vh - 40px);overflow:auto;padding:32px;background:var(--paper);box-shadow:0 18px 60px rgba(0,0,0,.18)}
.eyebrow{margin:0 0 10px;color:#a17f72;font-size:12.666px;letter-spacing:.2em}
h2{margin:0;font:400 27px var(--serif)}
.description{margin:12px 0 24px;color:var(--muted);font-size:14.666px;line-height:1.9}
label{display:grid;gap:8px;margin:16px 0;color:var(--ink);font-size:14.666px}
input{width:100%;padding:13px;border:1px solid var(--line);border-radius:0;background:#fffdfa;color:var(--ink);font:15.333px var(--sans)}
button{width:100%;margin-top:10px;border:0;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
@media(max-width:500px){.profile-card{padding:25px 20px}}
</style>
