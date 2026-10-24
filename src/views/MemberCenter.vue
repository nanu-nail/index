<template>
  <main class="flow-page member-page">
    <router-link class="back-home" to="/">← 𝚗𝚊𝚗𝚞.</router-link>
    <p class="eyebrow">MEMBER</p>
    <h1>會員中心</h1>
    <p class="flow-lead">查看個人預約紀錄與預約狀態。</p>

    <PageNotice v-if="!firebaseConfigured" title="會員功能尚未啟用" tone="warning">
      請先在 Firebase Console 設定專案，並建立本機 .env 設定檔。
    </PageNotice>
    <div v-else-if="authState.loading" class="loading-state" role="status">正在確認登入狀態…</div>
    <template v-else-if="!authState.user">
      <PageNotice title="登入後查看預約">
        使用 Google 帳號登入後，即可查看屬於自己的預約；送出後的預約由店家管理員確認。
      </PageNotice>
      <AuthControl class="member-auth" />
    </template>
    <template v-else>
      <section class="member-profile" aria-label="會員資料">
        <img v-if="authState.user.photoURL" :src="authState.user.photoURL" alt="會員頭像" referrerpolicy="no-referrer">
        <div><strong>{{ (authState.memberProfile && authState.memberProfile.customerName) || '會員' }}</strong><span>{{ (authState.memberProfile && authState.memberProfile.phone) || '' }}・{{ authState.user.email }}</span></div>
        <AuthControl class="member-logout" :show-profile="false" />
      </section>
      <section class="booking-history" aria-labelledby="history-title">
        <div class="history-heading"><div><p class="eyebrow">YOUR VISITS</p><h2 id="history-title">預約紀錄</h2></div></div>
        <div v-if="loadingBookings" class="loading-state" role="status">正在載入預約紀錄…</div>
        <PageNotice v-else-if="loadError" title="目前無法載入預約" tone="warning">{{ loadError }}</PageNotice>
        <div v-else-if="bookings.length === 0" class="empty-state">
          <span aria-hidden="true">✳</span><h3>還沒有預約紀錄</h3>
          <p>挑選喜歡的服務與時段，為自己留一點時間。</p>
          <router-link class="button button-dark" to="/booking">開始預約</router-link>
        </div>
        <div v-else class="booking-list">
          <article v-for="booking in bookings" :key="booking.id" class="booking-item">
            <div class="booking-date"><strong>{{ formatDate(booking.date) }}</strong><span>{{ formatHour(booking.startHour) }}</span></div>
            <div class="booking-description"><h3>{{ booking.serviceName }}</h3><p>訂單編號：{{ booking.id }}</p><p>{{ booking.designCategory }}<span v-if="booking.designWorkTitle"> · {{ booking.designWorkTitle }}</span></p><p v-if="booking.selectedAddOns && booking.selectedAddOns.length">加購：{{ getBookingAddOnSummary(booking) }}</p></div>
            <div class="booking-state"><span :class="`status status--${booking.status}`">{{ statusLabel(booking.status) }}</span><strong>{{ Number(booking.price) === 0 ? '私訊報價' : `NT$ ${getBookingTotalPrice(booking)}` }}</strong></div>
          </article>
        </div>
      </section>
    </template>
    <router-link v-if="authState.user || !firebaseConfigured" class="text-link" to="/">返回首頁</router-link>
  </main>
</template>

<script>
import AuthControl from '../components/AuthControl.vue'
import PageNotice from '../components/PageNotice.vue'
import { authState } from '../services/auth'
import { getMyBookings } from '../services/bookings'
import { firebaseConfigured } from '../services/firebase'
import getBookingTotalPrice, { getBookingAddOnSummary } from '../utils/getBookingTotalPrice'

export default {
  name: 'MemberCenter',
  components: { AuthControl, PageNotice },
  data () {
    return {
      authState,
      firebaseConfigured,
      bookings: [],
      loadingBookings: false,
      loadError: ''
    }
  },
  watch: {
    'authState.user': {
      immediate: true,
      handler (user) {
        if (user) this.loadBookings(user.uid)
        else this.bookings = []
      }
    }
  },
  methods: {
    getBookingTotalPrice,
    getBookingAddOnSummary,
    async loadBookings (userId) {
      this.loadingBookings = true
      this.loadError = ''
      try {
        this.bookings = await getMyBookings(userId)
      } catch (error) {
        this.loadError = '請確認 Firestore 已啟用並套用安全規則，再重新整理頁面。'
      } finally {
        this.loadingBookings = false
      }
    },
    formatHour (hour) {
      return `${String(hour).padStart(2, '0')}:00`
    },
    formatDate (date) {
      const value = date && typeof date.toDate === 'function' ? date.toDate() : date
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    },
    statusLabel (status) {
      return { pending: '待確認', confirmed: '已確認', cancelled: '已取消', completed: '已完成' }[status] || '狀態更新中'
    }
  }
}
</script>

<style scoped>
.flow-page{width:min(860px,88%);min-height:65vh;margin:0 auto;padding:56px 0 88px}
.back-home{display:inline-block;margin-bottom:48px;color:var(--muted);font-size:14.666px}
.flow-page h1{margin:0 0 12px;font:400 clamp(28px,5vw,42px)/1.5 var(--serif);letter-spacing:.08em}
.flow-lead{margin:0 0 32px;color:var(--muted);font-size:15.666px;line-height:2}
.member-auth{margin-top:22px}
.member-profile{display:flex;align-items:center;gap:14px;margin:30px 0 56px;padding:18px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.member-profile>img{width:48px;height:48px;border-radius:50%;object-fit:cover}
.member-profile>div{display:grid;gap:5px;min-width:0}.member-profile strong{font:16px var(--serif);font-weight:400}.member-profile span{color:var(--muted);font-size:13.666px}
.member-logout{margin-left:auto}.history-heading{margin-bottom:22px}.history-heading .eyebrow{margin-bottom:8px}.history-heading h2{margin:0;font:400 24px var(--serif)}
.loading-state,.empty-state{padding:32px 0;color:var(--muted);font-size:15.666px}
.empty-state{text-align:center;padding:42px 20px;background:var(--cream)}.empty-state>span{color:#a4796b;font-size:22px}.empty-state h3{margin:12px 0 8px;font:18px var(--serif);font-weight:400;color:var(--ink)}.empty-state p{font-size:14.666px;line-height:1.8}.empty-state .button{margin-top:10px}
.booking-list{border-top:1px solid var(--line)}.booking-item{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:16px;padding:20px 8px;border-bottom:1px solid var(--line)}
.booking-date{display:grid;gap:6px}.booking-date strong{font-size:15.666px;font-weight:500}.booking-date span,.booking-description p{color:var(--muted);font-size:13.666px}.booking-description h3{margin:0 0 6px;font:16px var(--serif);font-weight:400}.booking-description p{margin:0}.booking-state{display:grid;justify-items:end;gap:8px}.booking-state strong{font-size:14.666px;font-weight:500}
.status{padding:5px 9px;border-radius:18px;background:#f4ece6;color:#8d6658;font-size:12.666px}.status--confirmed{background:#e9f1e8;color:#587255}.status--cancelled{background:#f4e9e7;color:#935c52}.status--completed{background:#eeeae5;color:#756960}
.text-link{display:inline-block;margin-top:28px;font-size:14.666px}.text-link span{margin-left:8px}
@media(max-width:600px){.flow-page{padding-top:34px}.back-home{margin-bottom:34px}.booking-item{grid-template-columns:88px minmax(0,1fr) 68px;gap:9px;padding:16px 0}.booking-date strong{font-size:13.333px;white-space:nowrap;line-height:1.45}.booking-date span{font-size:12.333px;white-space:nowrap}.booking-description{min-width:0}.booking-description h3{font-size:15.333px}.booking-state{min-width:0}.booking-state strong{max-width:68px;font-size:12.333px;text-align:right;overflow-wrap:anywhere}.member-profile{margin:24px 0 42px}.member-logout{font-size:12.666px}}
</style>
