<template>
  <main class="admin-page">
    <router-link class="back-home" to="/">← NANU NAIL</router-link>
    <header class="admin-heading"><p class="eyebrow">STUDIO ADMIN</p><h1>店家管理</h1><p>管理預約、服務內容、作品展示與公休日。</p></header>

    <PageNotice v-if="!firebaseConfigured" title="管理功能尚未啟用" tone="warning">
      請先設定 Firebase 專案與本機 .env，再使用可信任的 Firebase 管理員權限開放此頁。
    </PageNotice>
    <div v-else-if="authState.loading" class="loading-state" role="status">正在確認管理者權限…</div>
    <template v-else-if="!authState.user">
      <PageNotice title="管理員登入">使用已設定管理權限的 Google 帳號登入。</PageNotice>
      <AuthControl class="admin-auth" />
    </template>
    <PageNotice v-else-if="!authState.isAdmin" title="此帳號沒有管理權限" tone="warning">
      管理權限由 Firebase Authentication 自訂宣告控制，一般會員不能自行開通。請使用店家管理者帳號登入。
    </PageNotice>
    <template v-else>
      <section class="admin-toolbar">
        <div><strong>{{ authState.user.displayName || authState.user.email }}</strong><span>管理者</span></div>
        <AuthControl />
      </section>
      <div v-if="loading" class="loading-state" role="status">正在載入管理資料…</div>
      <PageNotice v-else-if="loadError" title="無法載入管理資料" tone="warning">{{ loadError }}</PageNotice>
      <template v-else>
        <nav class="admin-tabs" aria-label="管理功能">
          <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
        </nav>

        <section v-if="activeTab === 'pending-bookings'" class="admin-section">
          <div class="section-title"><div><p class="eyebrow">PENDING REQUESTS</p><h2>待確認預約</h2></div><button type="button" class="refresh-button" @click="refreshBookings">重新整理</button></div>
          <PageNotice v-if="actionMessage" :tone="actionError ? 'warning' : 'info'">{{ actionMessage }}</PageNotice>
          <div v-if="pendingBookings.length === 0" class="empty-admin">目前沒有待確認預約。</div>
          <div v-else class="admin-list">
            <article v-for="booking in pendingBookings" :key="booking.id" class="admin-booking">
              <div class="admin-booking-main"><div><strong>{{ formatDate(booking.date) }}・{{ formatHour(booking.startHour) }}</strong><span>姓名：{{ booking.customerName || '未提供' }}</span><span>電話：{{ booking.customerPhone || '舊訂單未留存' }}</span><span>信箱：{{ booking.customerEmail || '未提供' }}</span><span>訂單編號：{{ booking.id }}</span></div><div><h3>{{ booking.serviceName }} <small>{{ booking.designCategory }}<span v-if="booking.designWorkTitle">・{{ booking.designWorkTitle }}</span></small></h3><span><small v-if="booking.selectedAddOns && booking.selectedAddOns.length">加購：{{ getBookingAddOnSummary(booking) }}</small><span>{{ bookingPriceDisplay(booking) }}・約 {{ booking.durationMinutes }} 分鐘</span></span></div><span :class="`status status--${booking.status}`">{{ statusLabel(booking.status) }}</span></div>
              <div class="admin-booking-meta">下單時間：{{ formatBookingCreatedAt(booking.createdAt) }}</div>
              <div class="admin-booking-actions">
                <button type="button" @click="changeBookingStatus(booking, 'confirmed')">確認預約</button>
                <button type="button" class="danger-action" @click="changeBookingStatus(booking, 'cancelled')">管理員取消</button>
              </div>
            </article>
          </div>
        </section>

        <section v-if="activeTab === 'confirmed-bookings'" class="admin-section">
          <div class="section-title"><div><p class="eyebrow">CONFIRMED BOOKINGS</p><h2>已確認預約</h2></div><button type="button" class="refresh-button" @click="refreshBookings">重新整理</button></div>
          <PageNotice v-if="actionMessage" :tone="actionError ? 'warning' : 'info'">{{ actionMessage }}</PageNotice>
          <div class="confirmed-calendar">
            <div class="confirmed-calendar-toolbar"><button type="button" aria-label="上個月" @click="changeConfirmedCalendarMonth(-1)">‹</button><strong>{{ confirmedCalendarLabel }}</strong><button type="button" aria-label="下個月" @click="changeConfirmedCalendarMonth(1)">›</button></div>
            <div class="confirmed-calendar-weekdays"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
            <div class="confirmed-calendar-grid">
              <div v-for="cell in confirmedCalendarCells" :key="cell.key" class="confirmed-calendar-cell" :class="{ 'confirmed-calendar-cell--empty': !cell.date }">
                <template v-if="cell.date"><strong>{{ cell.day }}</strong><div v-for="booking in cell.bookings" :key="booking.id" class="confirmed-calendar-event"><b>{{ formatHour(booking.startHour) }}</b><span>{{ booking.customerName || booking.customerEmail }}</span><small>{{ booking.serviceName }}</small></div></template>
              </div>
            </div>
          </div>
          <h3 class="subsection-heading">預約列表</h3>
          <div v-if="confirmedBookings.length === 0" class="empty-admin">目前沒有已確認預約。</div>
          <div v-else class="admin-list">
            <article v-for="booking in confirmedBookings" :key="booking.id" class="admin-booking">
              <div class="admin-booking-main"><div><strong>{{ formatDate(booking.date) }}・{{ formatHour(booking.startHour) }}</strong><span>姓名：{{ booking.customerName || '未提供' }}</span><span>電話：{{ booking.customerPhone || '舊訂單未留存' }}</span><span>信箱：{{ booking.customerEmail || '未提供' }}</span><span>訂單編號：{{ booking.id }}</span></div><div><h3>{{ booking.serviceName }} <small>{{ booking.designCategory }}<span v-if="booking.designWorkTitle">・{{ booking.designWorkTitle }}</span></small></h3><span><small v-if="booking.selectedAddOns && booking.selectedAddOns.length">加購：{{ getBookingAddOnSummary(booking) }}</small><span>{{ bookingPriceDisplay(booking) }}・約 {{ booking.durationMinutes }} 分鐘</span></span></div><span :class="`status status--${booking.status}`">{{ statusLabel(booking.status) }}</span></div>
              <div class="admin-booking-actions"><button type="button" @click="changeBookingStatus(booking, 'completed')">標記完成</button><button type="button" class="danger-action" @click="changeBookingStatus(booking, 'cancelled')">管理員取消</button></div>
            </article>
          </div>
        </section>

        <section v-if="activeTab === 'services'" class="admin-section">
          <div class="section-title"><div><p class="eyebrow">SERVICE MENU</p><h2>服務項目</h2></div><button type="button" class="subtle-button" @click="resetServiceDraft">新增服務</button></div>
          <PageNotice v-if="actionMessage" :tone="actionError ? 'warning' : 'info'">{{ actionMessage }}</PageNotice>
          <form class="admin-form" @submit.prevent="saveServiceForm">
            <h3>{{ serviceDraft.id ? '編輯服務' : '新增服務' }}</h3>
            <label>服務名稱<input v-model.trim="serviceDraft.name" required maxlength="60"></label>
            <label>服務說明<textarea v-model.trim="serviceDraft.description" rows="2" maxlength="240"></textarea></label>
            <div class="form-row"><label>價格（NT$；0 顯示私訊報價）<input v-model.number="serviceDraft.price" type="number" min="0" step="1" required></label><label>預估時間（分鐘）<input v-model.number="serviceDraft.durationMinutes" type="number" min="1" max="240" step="1" required></label><label>排序<input v-model.number="serviceDraft.sortOrder" type="number" min="0" step="1"></label></div>
            <p class="form-hint">設定為 0 時，前台會顯示「私訊報價」。管理員可隨時在此填入價格並儲存服務項目。</p>
            <fieldset class="addon-editor"><legend>加購選項</legend>
              <div v-for="(addon, index) in serviceDraft.addOns" :key="addon.id" class="addon-editor-row">
                <label>選項名稱<input v-model.trim="addon.name" required maxlength="60" placeholder="例如：卸甲"></label>
                <label>加價（NT$）<input v-model.number="addon.price" type="number" min="0" step="1" required></label>
                <button type="button" class="addon-remove" :aria-label="`移除第 ${index + 1} 個加購選項`" @click="removeServiceAddon(index)">移除</button>
              </div>
              <button type="button" class="subtle-button addon-add" @click="addServiceAddon">＋新增加購選項</button>
            </fieldset>
            <label class="check-label"><input v-model="serviceDraft.active" type="checkbox"> 顯示於預約頁</label>
            <div class="form-actions"><button class="primary-action" type="submit" :disabled="saving">{{ saving ? '儲存中…' : '儲存服務' }}</button><button v-if="serviceDraft.id" type="button" @click="resetServiceDraft">取消編輯</button></div>
          </form>
          <div class="admin-list">
            <article v-for="service in services" :key="service.id" class="catalog-row"><div><strong>{{ service.name }}</strong><span>{{ service.description }}・{{ Number(service.price) === 0 ? '私訊報價' : `NT$ ${service.price}` }}・{{ service.durationMinutes }} 分鐘</span><small v-for="addon in service.addOns || []" :key="addon.id">加購：{{ addon.name }}・+NT$ {{ addon.price }}</small><small>{{ service.active ? '上架中' : '已停用' }}</small></div><div class="row-actions"><button type="button" @click="editService(service)">編輯</button><button type="button" @click="toggleService(service)">{{ service.active ? '停用' : '啟用' }}</button></div></article>
          </div>
        </section>

        <section v-if="activeTab === 'works'" class="admin-section">
          <div class="section-title"><div><p class="eyebrow">PORTFOLIO</p><h2>作品展示</h2></div><button type="button" class="subtle-button" @click="resetWorkDraft">新增作品</button></div>
          <PageNotice v-if="actionMessage" :tone="actionError ? 'warning' : 'info'">{{ actionMessage }}</PageNotice>
          <form class="admin-form" @submit.prevent="saveWorkForm">
            <h3>{{ workDraft.id ? '編輯作品' : '新增作品' }}</h3>
            <label>作品名稱<input v-model.trim="workDraft.title" required maxlength="60"></label>
            <label>風格分類<select v-model="workDraft.category"><option v-for="category in styleCategories" :key="category" :value="category">{{ category }}</option></select></label>
            <label>作品圖片網址<input v-model.trim="workDraft.imageURL" type="url" placeholder="https://…"></label>
            <label>圖片替代文字<input v-model.trim="workDraft.alt" maxlength="120"></label>
            <div class="form-row"><label>排序<input v-model.number="workDraft.sortOrder" type="number" min="0"></label><label class="check-label"><input v-model="workDraft.active" type="checkbox"> 顯示於網站</label></div>
            <div class="form-actions"><button class="primary-action" type="submit" :disabled="saving">{{ saving ? '儲存中…' : '儲存作品' }}</button><button v-if="workDraft.id" type="button" @click="resetWorkDraft">取消編輯</button></div>
          </form>
          <p class="form-hint">請使用店家擁有或已取得網站使用授權的圖片網址。圖片上傳功能可在後續接入 Firebase Storage。</p>
          <div class="admin-list">
            <article v-for="work in works" :key="work.id" class="catalog-row"><div><strong>{{ work.title }}</strong><span>{{ work.category }}<small>{{ work.active ? '・上架中' : '・已停用' }}</small></span></div><div class="row-actions"><button type="button" @click="editWork(work)">編輯</button><button type="button" @click="toggleWork(work)">{{ work.active ? '停用' : '啟用' }}</button></div></article>
          </div>
        </section>

        <section v-if="activeTab === 'schedule'" class="admin-section">
          <div class="section-title"><div><p class="eyebrow">HOURS & DAYS OFF</p><h2>營業時間與公休日</h2></div></div>
          <PageNotice v-if="actionMessage" :tone="actionError ? 'warning' : 'info'">{{ actionMessage }}</PageNotice>
          <form class="admin-form" @submit.prevent="saveHours">
            <h3>每日營業時間</h3>
            <div class="form-row"><label>開始時間<select v-model.number="settings.openHour"><option v-for="hour in allHours" :key="hour" :value="hour">{{ formatHour(hour) }}</option></select></label><label>結束時間<select v-model.number="settings.closeHour"><option v-for="hour in closingHours" :key="hour" :value="hour">{{ formatHour(hour) }}</option></select></label></div>
            <p class="form-hint">目前為每小時一個開始時段，兩筆預約開始時間至少相隔 4 小時。最後時段會依服務時間及結束時間自動限制。</p>
            <button class="primary-action" type="submit" :disabled="saving">{{ saving ? '儲存中…' : '儲存營業時間' }}</button>
          </form>
          <form class="admin-form" @submit.prevent="addBlockedDate">
            <h3>用月曆選取公休日</h3>
            <div class="holiday-calendar-toolbar"><button type="button" aria-label="上個月" @click="changeHolidayMonth(-1)">‹</button><strong>{{ holidayCalendarLabel }}</strong><button type="button" aria-label="下個月" @click="changeHolidayMonth(1)">›</button></div>
            <div class="holiday-calendar-weekdays" aria-hidden="true"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
            <div class="holiday-calendar-grid" role="group" aria-label="選取公休日日期">
              <span v-for="cell in holidayCalendarCells" :key="cell.key" :class="{ 'holiday-calendar-empty': !cell.date }">
                <button v-if="cell.date" type="button" :class="{ selected: selectedBlockedDates.includes(cell.date), existing: isBlockedDate(cell.date) }" :aria-pressed="selectedBlockedDates.includes(cell.date) ? 'true' : 'false'" @click="toggleSelectedBlockedDate(cell.date)">{{ cell.day }}</button>
              </span>
            </div>
            <p class="form-hint">點日期即可複選，再次點擊可取消。跨月份選取時，可使用月曆左右按鈕切換。</p>
            <p class="form-hint">已選取 {{ selectedBlockedDates.length }} 天</p>
            <label>備註<input v-model.trim="blockedDateDraft.note" maxlength="120" placeholder="選填，例如店休"></label>
            <button class="primary-action" type="submit" :disabled="saving || selectedBlockedDates.length === 0">{{ saving ? '儲存中…' : `批次新增 ${selectedBlockedDates.length} 天公休日` }}</button>
          </form>
          <form class="admin-form" @submit.prevent="addOpenMonth">
            <h3>新增開放預約月份</h3>
            <div class="form-row"><label>選擇月份<input v-model="openMonthDraft" type="month" required></label></div>
            <p class="form-hint">第一次新增後，預約只會開放清單中的月份；未列出的月份會顯示為不可預約。尚未設定清單時，維持目前所有未來月份皆可查看的行為。</p>
            <button class="primary-action" type="submit" :disabled="saving">新增開放月份</button>
            <div v-if="settings.openMonths" class="open-month-list">
              <div v-if="settings.openMonths.length === 0" class="empty-admin">目前沒有開放月份。</div>
              <div v-for="month in settings.openMonths" :key="month" class="open-month-row"><strong>{{ formatOpenMonth(month) }}</strong><button type="button" @click="removeOpenMonth(month)">移除</button></div>
            </div>
          </form>
          <h3 class="subsection-heading">已設定公休日</h3>
          <div v-if="blockedDates.length === 0" class="empty-admin">目前沒有特殊公休日。</div>
          <div v-else class="admin-list"><article v-for="date in blockedDates" :key="date.id" class="catalog-row"><div><strong>{{ date.date }}</strong><span>{{ date.note || '公休日' }}<small>{{ date.active ? '・生效中' : '・已停用' }}</small></span></div><button type="button" @click="removeBlockedDate(date)">刪除</button></article></div>
        </section>
      </template>
    </template>
    <router-link class="text-link" to="/">返回首頁 <span>↗</span></router-link>
  </main>
</template>

<script>
import AuthControl from '../components/AuthControl.vue'
import PageNotice from '../components/PageNotice.vue'
import { authState } from '../services/auth'
import { firebaseConfigured } from '../services/firebase'
import { getAllBookings, setBookingStatus, DEFAULT_BOOKING_SETTINGS, getTaipeiDateString } from '../services/bookings'
import getBookingTotalPrice, { getBookingAddOnSummary } from '../utils/getBookingTotalPrice'
import {
  deleteBlockedDate,
  getAdminBookingSettings,
  getAllServices,
  getAllWorks,
  getBlockedDates,
  saveBlockedDatesBatch,
  saveBookingSettings,
  saveService,
  saveWork
} from '../services/admin'

export default {
  name: 'AdminDashboard',
  components: { AuthControl, PageNotice },
  data () {
    return {
      authState,
      firebaseConfigured,
      tabs: [
        { id: 'pending-bookings', label: '待確認預約' },
        { id: 'confirmed-bookings', label: '已確認預約' },
        { id: 'services', label: '服務項目' },
        { id: 'works', label: '作品展示' },
        { id: 'schedule', label: '營業與公休' }
      ],
      activeTab: 'pending-bookings',
      bookings: [],
      services: [],
      works: [],
      blockedDates: [],
      confirmedCalendarMonth: getTaipeiDateString().slice(0, 7),
      settings: { ...DEFAULT_BOOKING_SETTINGS },
      loading: false,
      saving: false,
      loadError: '',
      actionMessage: '',
      actionError: false,
      serviceDraft: this.emptyService(),
      workDraft: this.emptyWork(),
      blockedDateDraft: { note: '' },
      selectedBlockedDates: [],
      holidayCalendarMonth: getTaipeiDateString().slice(0, 7),
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      openMonthDraft: '',
      styleCategories: ['簡約日常', '經典法式', '貓眼光澤', '造型設計'],
      allHours: Array.from({ length: 24 }, (_, index) => index),
      closingHours: Array.from({ length: 23 }, (_, index) => index + 1)
    }
  },
  computed: {
    pendingBookings () {
      return this.bookings
        .filter(booking => booking.status === 'pending')
        .sort((a, b) => this.timestampMillis(b.createdAt) - this.timestampMillis(a.createdAt))
    },
    confirmedBookings () {
      return this.bookings
        .filter(booking => booking.status === 'confirmed')
        .sort((a, b) => {
          const now = Date.now()
          const aTime = this.timestampMillis(a.startAt || a.date)
          const bTime = this.timestampMillis(b.startAt || b.date)
          const aUpcoming = aTime >= now
          const bUpcoming = bTime >= now
          if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
          return aUpcoming ? aTime - bTime : bTime - aTime
        })
    },
    confirmedCalendarLabel () {
      const [year, month] = this.confirmedCalendarMonth.split('-').map(Number)
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', year: 'numeric', month: 'long' })
        .format(new Date(Date.UTC(year, month - 1, 1)))
    },
    confirmedCalendarCells () {
      const [year, month] = this.confirmedCalendarMonth.split('-').map(Number)
      const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const bookingsByDate = {}
      this.confirmedBookings.forEach((booking) => {
        const date = getTaipeiDateString(this.timestampDate(booking.date))
        if (date.slice(0, 7) === this.confirmedCalendarMonth) {
          if (!bookingsByDate[date]) bookingsByDate[date] = []
          bookingsByDate[date].push(booking)
        }
      })
      const cells = Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, date: '' }))
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${this.confirmedCalendarMonth}-${String(day).padStart(2, '0')}`
        cells.push({ key: date, date, day, bookings: bookingsByDate[date] || [] })
      }
      while (cells.length % 7 !== 0) cells.push({ key: `empty-${cells.length}`, date: '' })
      return cells
    },
    holidayCalendarLabel () {
      const [year, month] = this.holidayCalendarMonth.split('-').map(Number)
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', year: 'numeric', month: 'long' })
        .format(new Date(Date.UTC(year, month - 1, 1)))
    },
    holidayCalendarCells () {
      const [year, month] = this.holidayCalendarMonth.split('-').map(Number)
      const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      const cells = Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, date: '' }))
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${this.holidayCalendarMonth}-${String(day).padStart(2, '0')}`
        cells.push({ key: date, date, day })
      }
      while (cells.length % 7 !== 0) cells.push({ key: `empty-${cells.length}`, date: '' })
      return cells
    }
  },
  watch: {
    'authState.isAdmin': {
      immediate: true,
      handler (isAdmin) {
        if (isAdmin && firebaseConfigured) this.loadAdminData()
      }
    }
  },
  methods: {
    getBookingTotalPrice,
    getBookingAddOnSummary,
    bookingPriceDisplay (booking) {
      return Number(booking.price) === 0 ? '私訊報價' : `NT$ ${getBookingTotalPrice(booking)}`
    },
    timestampDate (value) {
      if (value && typeof value.toDate === 'function') return value.toDate()
      if (value instanceof Date) return value
      return new Date(value)
    },
    timestampMillis (value) {
      const date = this.timestampDate(value)
      return Number.isFinite(date.getTime()) ? date.getTime() : 0
    },
    formatBookingCreatedAt (value) {
      if (!value) return '時間未記錄'
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).format(this.timestampDate(value))
    },
    changeConfirmedCalendarMonth (offset) {
      const [year, month] = this.confirmedCalendarMonth.split('-').map(Number)
      const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1))
      this.confirmedCalendarMonth = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`
    },
    emptyService () {
      return { id: '', name: '', description: '', price: 0, durationMinutes: 60, addOns: [], active: true, sortOrder: 0 }
    },
    emptyWork () {
      return { id: '', title: '', category: '簡約日常', imageURL: '', alt: '', active: true, sortOrder: 0 }
    },
    async loadAdminData () {
      this.loading = true
      this.loadError = ''
      try {
        const [bookings, services, works, blockedDates, settings] = await Promise.all([
          getAllBookings(), getAllServices(), getAllWorks(), getBlockedDates(), getAdminBookingSettings()
        ])
        this.bookings = bookings
        this.services = services.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        this.works = works.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        const today = getTaipeiDateString()
        const expiredDates = blockedDates.filter(date => date.date < today)
        await Promise.all(expiredDates.map(date => deleteBlockedDate(date.id)))
        this.blockedDates = blockedDates.filter(date => date.date >= today).sort((a, b) => a.date.localeCompare(b.date))
        this.settings = { ...DEFAULT_BOOKING_SETTINGS, ...(settings || {}) }
        if (!settings) await saveBookingSettings(this.settings)
      } catch (error) {
        this.loadError = '請確認已部署 Firestore 安全規則，且目前帳號具有管理者權限。'
      } finally {
        this.loading = false
      }
    },
    async refreshBookings () {
      this.actionMessage = ''
      try {
        this.bookings = await getAllBookings()
        this.flash('預約清單已更新。')
      } catch (error) {
        this.flash('重新載入預約失敗，請稍後再試。', true)
      }
    },
    async changeBookingStatus (booking, status) {
      this.actionMessage = ''
      try {
        await setBookingStatus(booking, status)
        await this.refreshBookings()
        this.flash(status === 'confirmed' ? '已確認預約。' : status === 'cancelled' ? '已取消預約並釋出時段。' : '已標記預約完成。')
      } catch (error) {
        this.flash('更新預約失敗，請重新整理後再試。', true)
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
      return { pending: '待確認', confirmed: '已確認', cancelled: '已取消', completed: '已完成' }[status] || '未知狀態'
    },
    async saveServiceForm () {
      const invalidAddOn = this.serviceDraft.addOns.some(addon => !addon.name.trim() || !Number.isInteger(Number(addon.price)) || Number(addon.price) < 0)
      if (!this.serviceDraft.name || !Number.isFinite(Number(this.serviceDraft.price)) || this.serviceDraft.price < 0 || this.serviceDraft.durationMinutes < 1 || invalidAddOn) {
        this.flash('請確認服務名稱、價格和服務時間。', true)
        return
      }
      this.saving = true
      try {
        await saveService(this.serviceDraft)
        this.services = (await getAllServices()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        this.resetServiceDraft()
        this.flash('服務項目已儲存。')
      } catch (error) {
        this.flash('儲存服務失敗，請檢查 Firestore 權限。', true)
      } finally {
        this.saving = false
      }
    },
    editService (service) {
      this.serviceDraft = { ...service, addOns: (service.addOns || []).map(addon => ({ ...addon })) }
      this.actionMessage = ''
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    addServiceAddon () {
      this.serviceDraft.addOns.push({ id: `addon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: '', price: 0 })
    },
    removeServiceAddon (index) {
      this.serviceDraft.addOns.splice(index, 1)
    },
    resetServiceDraft () {
      this.serviceDraft = this.emptyService()
    },
    async toggleService (service) {
      try {
        await saveService({ ...service, active: !service.active })
        this.services = (await getAllServices()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        this.flash(service.active ? '服務已停用。' : '服務已重新上架。')
      } catch (error) {
        this.flash('變更服務狀態失敗。', true)
      }
    },
    async saveWorkForm () {
      this.saving = true
      try {
        await saveWork(this.workDraft)
        this.works = (await getAllWorks()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        this.resetWorkDraft()
        this.flash('作品內容已儲存。')
      } catch (error) {
        this.flash('儲存作品失敗，請檢查 Firestore 權限。', true)
      } finally {
        this.saving = false
      }
    },
    editWork (work) {
      this.workDraft = { ...work }
      this.actionMessage = ''
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    resetWorkDraft () {
      this.workDraft = this.emptyWork()
    },
    async toggleWork (work) {
      try {
        await saveWork({ ...work, active: !work.active })
        this.works = (await getAllWorks()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        this.flash(work.active ? '作品已下架。' : '作品已重新上架。')
      } catch (error) {
        this.flash('變更作品狀態失敗。', true)
      }
    },
    async saveHours () {
      this.saving = true
      try {
        await saveBookingSettings(this.settings)
        this.settings = { ...this.settings, minStartGapHours: 4, timeZone: 'Asia/Taipei' }
        this.flash('營業時間已儲存。')
      } catch (error) {
        this.flash(error.message || '營業時間儲存失敗。', true)
      } finally {
        this.saving = false
      }
    },
    async addBlockedDate () {
      if (this.selectedBlockedDates.length === 0) {
        this.flash('請先在月曆選取公休日。', true)
        return
      }
      this.saving = true
      try {
        const count = await saveBlockedDatesBatch({ dates: this.selectedBlockedDates, note: this.blockedDateDraft.note })
        this.blockedDates = (await getBlockedDates()).sort((a, b) => a.date.localeCompare(b.date))
        this.selectedBlockedDates = []
        this.blockedDateDraft = { note: '' }
        this.flash(`已批次新增 ${count} 天公休日。`)
      } catch (error) {
        this.flash(error.message || '新增公休日失敗。', true)
      } finally {
        this.saving = false
      }
    },
    changeHolidayMonth (offset) {
      const [year, month] = this.holidayCalendarMonth.split('-').map(Number)
      const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1))
      this.holidayCalendarMonth = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`
    },
    toggleSelectedBlockedDate (date) {
      const index = this.selectedBlockedDates.indexOf(date)
      if (index >= 0) this.selectedBlockedDates.splice(index, 1)
      else this.selectedBlockedDates.push(date)
      this.selectedBlockedDates.sort()
    },
    isBlockedDate (date) {
      return this.blockedDates.some(item => item.date === date && item.active)
    },
    async removeBlockedDate (date) {
      try {
        await deleteBlockedDate(date.id)
        this.blockedDates = this.blockedDates.filter(item => item.id !== date.id)
        this.flash('公休日已刪除。')
      } catch (error) {
        this.flash('刪除公休日失敗。', true)
      }
    },
    formatOpenMonth (value) {
      const year = Math.floor(value / 100)
      const month = value % 100
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', year: 'numeric', month: 'long' })
        .format(new Date(Date.UTC(year, month - 1, 1)))
    },
    async addOpenMonth () {
      if (!/^\d{4}-\d{2}$/.test(this.openMonthDraft)) return
      const month = Number(this.openMonthDraft.replace('-', ''))
      if (month % 100 < 1 || month % 100 > 12) {
        this.flash('請選擇有效的月份。', true)
        return
      }
      const openMonths = [...new Set([...(this.settings.openMonths || []), month])].sort((a, b) => a - b)
      await this.persistOpenMonths(openMonths, '已新增開放月份。')
    },
    async removeOpenMonth (month) {
      const openMonths = (this.settings.openMonths || []).filter(item => item !== month)
      await this.persistOpenMonths(openMonths, '已移除開放月份。')
    },
    async persistOpenMonths (openMonths, message) {
      this.saving = true
      try {
        const nextSettings = { ...this.settings, openMonths }
        await saveBookingSettings(nextSettings)
        this.settings = nextSettings
        this.openMonthDraft = ''
        this.flash(message)
      } catch (error) {
        this.flash(error.message || '儲存開放月份失敗。', true)
      } finally {
        this.saving = false
      }
    },
    flash (message, isError = false) {
      this.actionMessage = message
      this.actionError = isError
    }
  }
}
</script>

<style scoped>
.admin-page{width:min(1040px,90%);min-height:70vh;margin:0 auto;padding:38px 0 90px}
.back-home{display:inline-block;margin-bottom:34px;color:var(--muted);font-size:14.666px}.admin-heading{margin-bottom:28px}.admin-heading .eyebrow{margin-bottom:8px}.admin-heading h1{margin:0 0 8px;font:400 clamp(28px,5vw,40px)/1.5 var(--serif);letter-spacing:.08em}.admin-heading>p:last-child{color:var(--muted);font-size:14.666px}
.admin-auth{margin-top:20px}.loading-state{padding:32px 0;color:var(--muted);font-size:15.666px}.admin-toolbar{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.admin-toolbar>div{display:flex;align-items:center;gap:10px;font-size:14.666px}.admin-toolbar>div span{padding:4px 8px;border-radius:14px;background:#e9f1e8;color:#587255;font-size:11.666px}
.admin-tabs{display:flex;gap:5px;overflow:auto;margin:28px 0 24px;border-bottom:1px solid var(--line)}.admin-tabs button{flex:0 0 auto;padding:12px 15px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--muted);font:14.666px var(--sans);cursor:pointer}.admin-tabs button.active{border-color:#a4796b;color:var(--ink)}.admin-section{padding-bottom:20px}.section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.section-title .eyebrow{margin-bottom:7px}.section-title h2{margin:0;font:400 24px var(--serif)}.refresh-button,.subtle-button{padding:9px 13px;border:1px solid var(--line);background:transparent;color:var(--ink);font:13.666px var(--sans);cursor:pointer}.empty-admin{padding:24px 10px;background:var(--cream);color:var(--muted);font-size:14.666px;text-align:center}
.admin-list{border-top:1px solid var(--line)}.admin-booking,.catalog-row{padding:17px 8px;border-bottom:1px solid var(--line)}.admin-booking-main{display:grid;grid-template-columns:170px 1fr auto;align-items:center;gap:18px}.admin-booking-main>div{display:grid;gap:6px}.admin-booking-main strong{font-size:14.666px;font-weight:500}.admin-booking-main span{color:var(--muted);font-size:12.666px}.admin-booking-main h3{margin:0;font:15px var(--serif);font-weight:400}.admin-booking-main h3 small{display:block;margin-top:5px;color:var(--muted);font:12.666px var(--sans)}.admin-booking-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.admin-booking-actions button,.row-actions button,.catalog-row>button{padding:7px 10px;border:1px solid var(--line);background:#fffdfa;color:var(--ink);font:12.666px var(--sans);cursor:pointer}.admin-booking-actions .danger-action{color:#9b5145}.status{padding:5px 9px;border-radius:18px;background:#f4ece6;color:#8d6658;font-size:12.666px!important;white-space:nowrap}.status--confirmed{background:#e9f1e8;color:#587255!important}.status--cancelled{background:#f4e9e7;color:#935c52!important}.status--completed{background:#eeeae5;color:#756960!important}
.admin-form{display:grid;gap:14px;margin:20px 0 26px;padding:20px;border:1px solid var(--line);background:#fffdfa}.admin-form h3,.subsection-heading{margin:0;font:17px var(--serif);font-weight:400}.admin-form label{display:grid;gap:7px;color:#665c56;font-size:12.666px}.admin-form input,.admin-form textarea,.admin-form select{width:100%;min-height:38px;padding:9px 10px;border:1px solid var(--line);background:#fff;color:var(--ink);font:14.666px var(--sans)}.admin-form textarea{resize:vertical}.form-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.admin-form .check-label{display:flex;align-items:center;gap:8px}.admin-form .check-label input{width:15px;min-height:15px}.form-actions{display:flex;gap:8px}.form-actions button,.primary-action{width:max-content;padding:10px 14px;border:1px solid var(--line);background:transparent;color:var(--ink);font:13.666px var(--sans);cursor:pointer}.form-actions .primary-action,.primary-action{border-color:var(--ink);background:var(--ink);color:#fff}.primary-action:disabled{opacity:.5;cursor:wait}.form-hint{margin:-5px 0 0;color:var(--muted);font-size:12.666px;line-height:1.8}.catalog-row{display:flex;align-items:center;justify-content:space-between;gap:14px}.catalog-row>div:first-child{display:grid;gap:6px;min-width:0}.catalog-row strong{font-size:14.666px;font-weight:500}.catalog-row span,.catalog-row small{color:var(--muted);font-size:12.666px}.row-actions{display:flex;gap:6px;flex:0 0 auto}.subsection-heading{margin:26px 0 14px}
.holiday-calendar-toolbar{display:grid;grid-template-columns:38px 1fr 38px;align-items:center;gap:10px;max-width:440px}.holiday-calendar-toolbar strong{text-align:center;font:16px var(--serif);font-weight:400}.holiday-calendar-toolbar button{height:36px;border:1px solid var(--line);background:#fffdfa;color:var(--ink);font:20px var(--sans);cursor:pointer}.holiday-calendar-weekdays,.holiday-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;max-width:440px}.holiday-calendar-weekdays{text-align:center;color:var(--muted);font-size:12.666px}.holiday-calendar-weekdays span{padding:7px 0}.holiday-calendar-grid>span{display:grid;place-items:center;min-height:40px}.holiday-calendar-grid button{width:38px;height:38px;border:1px solid var(--line);border-radius:50%;background:#fffdfa;color:var(--ink);font:14.666px var(--sans);cursor:pointer}.holiday-calendar-grid button.existing{border-color:#c77b72;color:#a55e56}.holiday-calendar-grid button.selected{border-color:#a55e56;background:#a55e56;color:white}.holiday-calendar-empty{visibility:hidden}.open-month-list{display:grid;gap:6px}.open-month-row{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:var(--cream);font-size:13.666px}.open-month-row button{padding:5px 9px;border:1px solid var(--line);background:#fffdfa;color:#935c52;font:12.666px var(--sans);cursor:pointer}
.addon-editor{display:grid;gap:12px;margin:0;padding:14px;border:1px solid var(--line)}.addon-editor legend{padding:0 6px;color:var(--ink);font:15.333px var(--serif)}.addon-editor-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,160px) auto;align-items:end;gap:10px}.addon-remove{min-height:38px;padding:8px 10px;border:1px solid var(--line);background:#fffdfa;color:#935c52;font:12.666px var(--sans);cursor:pointer}.addon-add{margin-top:2px}.text-link{display:inline-block;margin-top:28px;font-size:14.666px}.text-link span{margin-left:8px}
@media(max-width:700px){.admin-page{padding-top:28px}.admin-booking-main{grid-template-columns:1fr auto;gap:10px}.admin-booking-main>div:nth-child(2){grid-column:1/2}.admin-booking-main>.status{grid-column:2;grid-row:1}.admin-booking-actions{justify-content:flex-start}.form-row{grid-template-columns:1fr 1fr}.catalog-row{align-items:flex-start}.row-actions{flex-direction:column}.admin-toolbar{align-items:flex-start;gap:12px}.admin-toolbar .auth-control{font-size:12.666px}}
.admin-booking-meta{margin-top:8px;color:var(--muted);font-size:12.666px}.confirmed-calendar{margin:8px 0 30px;padding:16px;border:1px solid var(--line);background:#fffdfa}.confirmed-calendar-toolbar{display:grid;grid-template-columns:38px 1fr 38px;align-items:center;gap:10px;margin-bottom:12px}.confirmed-calendar-toolbar strong{text-align:center;font:16px var(--serif);font-weight:400}.confirmed-calendar-toolbar button{height:36px;border:1px solid var(--line);background:#fff;color:var(--ink);font:20px var(--sans);cursor:pointer}.confirmed-calendar-weekdays,.confirmed-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.confirmed-calendar-weekdays{text-align:center;color:var(--muted);font-size:12.666px}.confirmed-calendar-weekdays span{padding:6px 0}.confirmed-calendar-cell{min-width:0;min-height:94px;padding:5px;border:1px solid var(--line);background:#fff}.confirmed-calendar-cell>strong{display:block;margin-bottom:5px;font-size:12.666px;font-weight:500}.confirmed-calendar-cell--empty{visibility:hidden}.confirmed-calendar-event{display:grid;gap:2px;margin:3px 0;padding:4px;border-left:2px solid #8b6c5c;background:#f5eee9;color:#53463f;font-size:11.666px;overflow-wrap:anywhere}.confirmed-calendar-event b{font-size:11.666px}.confirmed-calendar-event small{color:var(--muted);font-size:10.666px}@media(max-width:600px){.confirmed-calendar{padding:8px}.confirmed-calendar-grid,.confirmed-calendar-weekdays{gap:2px}.confirmed-calendar-cell{min-height:65px;padding:3px}.confirmed-calendar-event{padding:2px;font-size:10.666px}.confirmed-calendar-event small{display:none}}
@media(max-width:600px){.addon-editor-row{grid-template-columns:1fr 1fr}.addon-remove{width:max-content}}
</style>
