<template>
  <main class="history-page">
    <router-link class="back-link" to="/admin">← 返回店家管理</router-link>
    <header class="history-heading"><p class="eyebrow">ORDERS & INCOME</p><h1>歷史訂單與收入</h1><p>依施作日期查詢每月訂單，掌握已完成收入與預計金額。</p></header>
    <PageNotice v-if="!firebaseConfigured" title="管理功能尚未啟用" tone="warning">請先完成 Firebase 設定。</PageNotice>
    <p v-else-if="authState.loading" class="history-message" role="status">正在確認管理者權限…</p>
    <template v-else-if="!authState.user"><PageNotice title="管理員登入">請使用店家的管理員帳號登入。</PageNotice><AuthControl :show-admin-link="false" /></template>
    <PageNotice v-else-if="!authState.isAdmin" title="此帳號沒有管理權限" tone="warning">僅管理員可以查詢歷史訂單與收入。</PageNotice>
    <template v-else>
      <section class="history-toolbar" aria-label="月份查詢">
        <h2 class="month-picker-title"><label for="history-month">施作月份</label></h2>
        <div class="month-picker"><button type="button" aria-label="查詢上個月" @click="changeMonth(-1)">‹</button><input id="history-month" v-model="selectedMonth" type="month" min="1000-01" max="9999-12" required><button type="button" aria-label="查詢下個月" @click="changeMonth(1)">›</button></div>
        <button type="button" class="refresh-button" :disabled="loading || !validMonth" @click="loadBookings">{{ loading ? '查詢中…' : '重新查詢' }}</button>
      </section>
      <PageNotice v-if="!validMonth" tone="warning">請選擇有效的查詢月份。</PageNotice>
      <p v-else-if="loading" class="history-message" role="status">正在查詢 {{ monthLabel }} 的訂單…</p>
      <PageNotice v-else-if="error" title="查詢失敗" tone="warning">{{ error }}</PageNotice>
      <template v-else>
        <section class="income-grid" aria-label="月份收入統計">
          <article class="income-card income-card--primary"><span>已完成收入</span><strong>{{ money(summary.completedIncome) }}</strong><small>僅計入已完成且金額已確定的訂單</small></article>
          <article class="income-card"><span>待完成預約金額</span><strong>{{ money(summary.projectedIncome) }}</strong><small>待確認與已確認，共 {{ summary.projectedCount }} 筆</small></article>
          <article class="income-card"><span>已完成訂單</span><strong>{{ summary.completedCount }}<em>筆</em></strong><small>當月全部訂單 {{ bookings.length }} 筆</small></article>
          <article class="income-card"><span>已取消訂單</span><strong>{{ summary.cancelledCount }}<em>筆</em></strong><small>取消訂單不計入收入或預計金額</small></article>
        </section>
        <PageNotice v-if="summary.completedUnpricedCount || summary.projectedUnpricedCount" title="部分訂單尚待填寫金額" tone="warning">已完成 {{ summary.completedUnpricedCount }} 筆、待完成 {{ summary.projectedUnpricedCount }} 筆尚未報價，未列入金額合計。私訊報價的主服務即使有加購，也須先確定最終金額。</PageNotice>
        <p class="income-note">{{ monthLabel }} · 依施作日期歸屬月份；優先使用訂單最終金額，未調整則採原服務價格加上加購。統計為收入，尚未扣除成本。</p>
        <section class="orders-panel" aria-labelledby="orders-title">
          <header class="orders-heading"><div><p class="eyebrow">MONTHLY ORDERS</p><h2 id="orders-title">訂單明細 <span>{{ filteredBookings.length }} 筆</span></h2></div><label>訂單狀態<select v-model="statusFilter"><option value="all">全部狀態</option><option value="pending">待確認</option><option value="confirmed">已確認</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select></label></header>
          <p class="filter-note">狀態篩選僅影響下方清單，上方統計維持整月合計。</p>
          <div v-if="!filteredBookings.length" class="history-message">{{ bookings.length ? '此月份沒有符合狀態的訂單。' : '此月份尚無訂單。' }}</div>
          <div v-else class="order-list">
            <article v-for="booking in filteredBookings" :key="booking.id" class="order-row">
              <div class="order-date"><strong>{{ formatDate(booking.date) }}</strong><span>{{ formatTime(booking.startAt, booking.startHour) }}<template v-if="booking.endAt">–{{ formatTime(booking.endAt) }}</template></span><small class="order-id">{{ booking.id }}</small></div>
              <div class="order-customer"><strong>{{ booking.customerName || '未提供姓名' }}</strong><span>{{ booking.customerPhone || '未留存電話' }}</span><small>{{ booking.customerEmail || '未留存信箱' }}</small></div>
              <div class="order-service"><strong>{{ booking.serviceName || '未留存服務名稱' }}</strong><span v-if="booking.selectedAddOns && booking.selectedAddOns.length">加購：{{ addOnSummary(booking) }}</span></div>
              <div class="order-amount"><strong :class="{ 'amount-unpriced': incomeAmount(booking) === null }">{{ incomeAmount(booking) === null ? '待填金額' : money(incomeAmount(booking)) }}</strong><span class="order-status" :class="`order-status--${booking.status}`">{{ statusLabel(booking.status) }}</span></div>
            </article>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>

<script>
import AuthControl from '../components/AuthControl.vue'
import PageNotice from '../components/PageNotice.vue'
import { authState } from '../services/auth'
import { firebaseConfigured } from '../services/firebase'
import { getBookingsByMonth, getTaipeiDateString } from '../services/bookings'
import { getBookingAddOnSummary } from '../utils/getBookingTotalPrice'
import { getBookingMonthRange, getBookingIncomeAmount, summarizeBookingIncome } from '../utils/bookingIncome'

export default {
  name: 'AdminOrderHistory',
  components: { AuthControl, PageNotice },
  data () {
    return { authState, firebaseConfigured, selectedMonth: getTaipeiDateString().slice(0, 7), statusFilter: 'all', bookings: [], loading: false, error: '', requestId: 0 }
  },
  computed: {
    validMonth () {
      try { getBookingMonthRange(this.selectedMonth); return true } catch (error) { return false }
    },
    monthLabel () {
      if (!this.validMonth) return ''
      const [year, month] = this.selectedMonth.split('-').map(Number)
      return `${year} 年 ${month} 月`
    },
    summary () { return summarizeBookingIncome(this.bookings) },
    filteredBookings () { return this.statusFilter === 'all' ? this.bookings : this.bookings.filter(booking => booking.status === this.statusFilter) }
  },
  watch: {
    'authState.isAdmin': { immediate: true, handler () { this.loadBookings() } },
    selectedMonth () { this.loadBookings() }
  },
  beforeDestroy () { this.requestId += 1 },
  methods: {
    incomeAmount: getBookingIncomeAmount,
    addOnSummary: getBookingAddOnSummary,
    money (value) { return `NT$ ${new Intl.NumberFormat('zh-TW').format(value)}` },
    statusLabel (status) { return { pending: '待確認', confirmed: '已確認', completed: '已完成', cancelled: '已取消' }[status] || '未知狀態' },
    toDate (value) { return value && typeof value.toDate === 'function' ? value.toDate() : new Date(value) },
    formatDate (value) {
      const date = this.toDate(value)
      return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', weekday: 'short' }).format(date) : '日期未留存'
    },
    formatTime (value, fallbackHour) {
      if (!value) return Number.isInteger(fallbackHour) ? `${String(fallbackHour).padStart(2, '0')}:00` : ''
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(this.toDate(value))
    },
    changeMonth (offset) {
      if (!this.validMonth) return
      const [year, month] = this.selectedMonth.split('-').map(Number)
      const next = new Date(Date.UTC(year, month - 1 + offset, 1))
      if (next.getUTCFullYear() < 1000 || next.getUTCFullYear() > 9999) return
      this.selectedMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
    },
    async loadBookings () {
      const requestId = ++this.requestId
      this.bookings = []
      this.error = ''
      this.loading = false
      if (!this.firebaseConfigured || !this.authState.isAdmin || !this.validMonth) return
      this.loading = true
      try {
        const bookings = await getBookingsByMonth(this.selectedMonth)
        if (requestId === this.requestId && this.authState.isAdmin) this.bookings = bookings
      } catch (error) {
        if (requestId === this.requestId) this.error = error.code === 'permission-denied' ? '無權讀取訂單，請確認登入帳號具有管理員權限。' : '無法查詢此月份訂單，請檢查網路後重新查詢。'
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.history-page{width:min(1120px,90%);min-height:70vh;margin:0 auto;padding:38px 0 90px}.back-link{display:inline-block;margin-bottom:30px;color:var(--muted);font-size:14px}.history-heading{margin-bottom:28px}.history-heading .eyebrow{margin-bottom:8px}.history-heading h1{margin:0 0 10px;font:400 clamp(26px,4vw,36px)/1.5 var(--serif);letter-spacing:.06em}.history-heading>p:last-child{color:var(--muted);font-size:14px;line-height:1.8}.history-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;padding:20px;border:1px solid var(--line);border-radius:10px;background:#fffdfa}.month-picker-title{flex:0 0 100%;margin:0;font:400 18px/1.5 var(--serif);color:var(--ink)}.month-picker{display:flex;align-items:center;gap:14px}.orders-heading label{display:grid;gap:7px;color:var(--muted);font-size:12px}.month-picker input,.orders-heading select{min-width:0;min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:5px;background:white;color:var(--ink);font:14px var(--sans)}.month-picker>button{display:grid;place-items:center;flex-shrink:0;width:34px;height:40px;padding:0;line-height:1;border:1px solid var(--line);border-radius:5px;background:transparent;color:var(--ink);font-size:22px;cursor:pointer}.refresh-button{padding:10px 14px;border:1px solid var(--line);border-radius:5px;background:transparent;color:var(--ink);font:13px var(--sans);cursor:pointer}.refresh-button:disabled{opacity:.5;cursor:wait}.income-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:24px 0}.income-card{display:grid;align-content:start;gap:13px;padding:22px 18px;border:1px solid var(--line);border-radius:10px;background:#fffdfa}.income-card>span{font-size:13px;color:var(--muted)}.income-card>strong{font:400 clamp(21px,2.7vw,29px)/1.3 var(--serif);overflow-wrap:anywhere}.income-card>strong em{margin-left:8px;font:12px var(--sans);color:var(--muted)}.income-card>small{font-size:11px;color:var(--muted);line-height:1.8}.income-card--primary{background:#f2e8df;border-color:#dcc8b9}.income-card--primary>strong{color:#795746}.income-note,.filter-note{margin:16px 0 22px;color:var(--muted);font-size:12px;line-height:1.9}.orders-panel{margin-top:28px;padding:24px;border:1px solid var(--line);border-radius:10px;background:#fffdfa}.orders-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.orders-heading .eyebrow{margin:0 0 7px;font-size:10px}.orders-heading h2{margin:0;font:400 21px var(--serif)}.orders-heading h2 span{margin-left:8px;font:12px var(--sans);color:var(--muted)}.order-list{border-top:1px solid var(--line)}.order-row{display:grid;grid-template-columns:minmax(120px,.9fr) minmax(130px,1fr) minmax(150px,1.5fr) auto;gap:18px;padding:22px 0;border-bottom:1px solid var(--line)}.order-row:last-child{border-bottom:0}.order-row>div{display:grid;align-content:start;gap:7px;min-width:0}.order-row strong{font-size:14px;font-weight:500}.order-row span,.order-row small{font-size:12px;color:var(--muted);line-height:1.7;overflow-wrap:anywhere}.order-row .order-id{font-size:10px;overflow-wrap:anywhere}.order-amount{text-align:right;justify-items:end}.order-amount .order-status{padding:4px 9px;border-radius:16px;background:#f4ece6;color:#8d6658;white-space:nowrap;font-size:11px}.order-amount .order-status--confirmed{background:#e9f1e8;color:#587255}.order-amount .order-status--cancelled{background:#f4e9e7;color:#935c52}.order-amount .order-status--completed{background:#eeeae5;color:#756960}.amount-unpriced{color:#a46e4b}.history-message{padding:32px 16px;color:var(--muted);font-size:14px;text-align:center;line-height:1.8}
@media(max-width:850px){.income-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.order-row{grid-template-columns:minmax(0,1fr) minmax(0,1.3fr) auto}.order-date{grid-column:1}.order-customer{grid-column:2}.order-amount{grid-column:3;grid-row:1/3}.order-service{grid-column:1/3}}
@media(max-width:520px){.history-page{padding-top:28px}.history-toolbar{align-items:flex-end;gap:10px;padding:14px}.month-picker{gap:7px}.month-picker input{width:145px}.month-picker>button{width:27px}.refresh-button{padding:10px 8px;font-size:12px}.income-grid{gap:10px;margin:18px 0}.income-card{padding:16px 12px}.income-card>strong{font-size:21px}.orders-panel{padding:18px 14px}.order-row{grid-template-columns:minmax(0,1fr) auto;gap:15px}.order-customer{grid-column:1;grid-row:2}.order-service{grid-column:1/-1;grid-row:3}.order-amount{grid-column:2;grid-row:1/3}.orders-heading h2{font-size:18px}}
</style>
