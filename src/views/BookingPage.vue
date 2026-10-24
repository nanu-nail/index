<template>
  <main class="booking-page">
    <router-link class="back-home" to="/">← 𝚗𝚊𝚗𝚞.</router-link>
    <header class="booking-heading">
      <p class="eyebrow">ONLINE BOOKING</p>
      <h1>為自己預約一段時光</h1>
      <p>選擇服務、喜歡的款式與日期時段；送出後會由店家確認。</p>
    </header>

    <PageNotice v-if="!firebaseConfigured" title="線上預約尚未啟用" tone="warning">
      Firebase 專案設定完成後，這裡就會顯示店家開放的服務、款式和即時時段。
    </PageNotice>
    <PageNotice v-else-if="catalogError" title="目前無法載入預約資料" tone="warning">{{ catalogError }}</PageNotice>
    <PageNotice v-else-if="!loadingCatalog && services.length === 0" title="店家尚未設定服務" tone="warning">
      請店家先到管理介面新增服務與價格，再開放線上預約。
    </PageNotice>
    <PageNotice v-else-if="!loadingCatalog && settings && !settings.configured" title="店家尚未設定營業時間" tone="warning">
      請店家先登入管理介面初始化營業時間設定，再開放線上預約。
    </PageNotice>

    <template v-else-if="firebaseConfigured">
      <div class="booking-progress" aria-label="預約步驟">
        <span :class="{ active: step === 'details' }">01 <small>選擇服務</small></span>
        <i></i><span :class="{ active: step === 'confirm' }">02 <small>確認資料</small></span>
        <i></i><span :class="{ active: step === 'success' }">03 <small>完成預約</small></span>
      </div>

      <div v-if="loadingCatalog" class="loading-state" role="status">正在載入服務項目…</div>
      <div v-else-if="step === 'success'" class="booking-success" role="status">
        <span class="success-mark" aria-hidden="true">✓</span>
        <p class="eyebrow">REQUEST RECEIVED</p>
        <h2>預約已送出</h2>
        <p>店家確認前，預約狀態為「待確認」。請保留以下預約編號。</p>
        <div class="booking-number"><span>預約編號</span><strong>{{ bookingId }}</strong></div>
        <a v-if="lineMessageUrl" class="button button-dark line-booking-link" :href="lineMessageUrl" target="_blank" rel="noopener noreferrer">加入官方 LINE 並傳送預約資料</a>
        <div v-if="lineMessageUrl && lineQrCode" class="line-booking-qr">
          <img :src="lineQrCode" alt="掃描 QR code，在 LINE 開啟預填的預約訊息">
          <p>請用手機 LINE 掃描 QR code，確認預約資料後按下發送。</p>
        </div>
        <p v-else-if="lineMessageUrl" class="line-booking-note">加入好友後，預約資料會先填入對話框，請確認內容並按下發送。</p>
      </div>

      <form v-else class="booking-form" @submit.prevent="continueToConfirm">
        <section class="form-section" aria-labelledby="service-heading">
          <div class="form-section-heading"><span>01</span><div><h2 id="service-heading">選擇服務</h2><p>依照喜歡的款式挑選服務項目。</p></div></div>
          <div class="service-options">
            <label v-for="service in services" :key="service.id" class="service-option" :class="{ selected: selectedServiceId === service.id }">
              <input v-model="selectedServiceId" type="radio" name="service" :value="service.id" required>
              <span class="radio-mark" aria-hidden="true"></span>
              <span class="service-option-copy"><strong>{{ service.name }}</strong><small>{{ service.description }}</small></span>
              <span class="service-option-meta"><strong>{{ Number(service.price) === 0 ? '私訊報價' : `NT$ ${service.price}` }}</strong><small>{{ formatDuration(Math.max(0, Number(service.durationMinutes) - 30)) }}</small></span>
            </label>
          </div>
          <div v-if="selectedService && selectedService.addOns && selectedService.addOns.length" class="addon-selection">
            <h3>加購選項（可複選及選擇數量）</h3>
            <div v-for="addon in selectedService.addOns" :key="addon.id" class="addon-option">
              <label class="addon-option-check"><input type="checkbox" :checked="addonQuantity(addon.id) > 0" @change="setAddonChecked(addon.id, $event.target.checked)"><span>{{ addon.name }}</span><strong>+NT$ {{ addon.price }}/個</strong></label>
              <select :value="addonQuantity(addon.id)" :disabled="addonQuantity(addon.id) === 0" :aria-label="`${addon.name}數量`" @change="setAddonQuantity(addon.id, $event.target.value)">
                <option value="0">0</option>
                <option v-for="quantity in getAddonQuantityOptions()" :key="quantity" :value="quantity">{{ quantity }}</option>
              </select>
            </div>
          </div>
        </section>

        <section class="form-section" aria-labelledby="date-heading">
          <div class="form-section-heading"><span>02</span><div><h2 id="date-heading">選擇日期與時段</h2></div></div>
          <div class="calendar-panel" aria-label="選擇預約日期">
            <div class="calendar-toolbar">
              <button type="button" aria-label="上一個月" :disabled="!canGoToPreviousMonth || loadingCalendar" @click="changeMonth(-1)">‹</button>
              <strong>{{ calendarMonthLabel }}</strong>
              <button type="button" aria-label="下一個月" :disabled="loadingCalendar" @click="changeMonth(1)">›</button>
              <button class="calendar-refresh" type="button" :disabled="loadingCalendar" @click="loadCalendarAvailability">{{ loadingCalendar ? '讀取中…' : '更新' }}</button>
            </div>
            <div class="calendar-legend" aria-label="日期狀態說明">
              <span><i class="legend-dot legend-dot--available"></i>剩餘時段</span>
              <span><i class="legend-dot legend-dot--unavailable"></i>休假日／預約已滿</span>
              <span><i class="legend-dot legend-dot--unopened"></i>尚未開放</span>
            </div>
            <PageNotice v-if="calendarError" tone="warning">{{ calendarError }}</PageNotice>
            <div class="calendar-weekdays" aria-hidden="true"><span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span></div>
            <div class="calendar-grid" role="group" :aria-label="`${calendarMonthLabel}日期`">
              <button
                v-for="cell in calendarCells"
                :key="cell.date || cell.key"
                type="button"
                class="calendar-day"
                :class="cell.date ? [`calendar-day--${cell.status}`, { selected: selectedDate === cell.date }] : 'calendar-day--empty'"
                :disabled="!cell.date || cell.status !== 'available' || loadingCalendar"
                :aria-hidden="!cell.date ? 'true' : null"
                :aria-pressed="cell.date && selectedDate === cell.date ? 'true' : 'false'"
                :aria-label="cell.date ? `${cell.date}，${calendarDateLabel(cell.status)}` : null"
                @click="cell.date && selectCalendarDate(cell.date)"
              >
                <span v-if="cell.date">{{ cell.day }}</span>
              </button>
            </div>
            <p v-if="loadingCalendar" class="calendar-loading" role="status">正在讀取本月預約狀況…</p>
          </div>
          <div v-if="selectedDate" class="time-picker">
            <div class="time-picker-heading"><strong>{{ selectedDate }} 可預約時段</strong><button type="button" :disabled="loadingCalendar" @click="loadCalendarAvailability">重新整理</button></div>
            <p v-if="loadingCalendar" class="availability-message" role="status">正在確認時段…</p>
            <PageNotice v-else-if="calendarError" tone="warning">{{ calendarError }}</PageNotice>
            <p v-else-if="selectedAvailableHours.length === 0" class="availability-message">目前沒有可預約時段，請重新整理或選擇其他日期。</p>
            <label v-else class="time-select-field"><span>選擇開始時間</span><select v-model="selectedHour" required><option :value="null" disabled>請選擇時段</option><option v-for="hour in selectedAvailableHours" :key="hour" :value="hour">{{ formatHour(hour) }}–{{ formatEndHour(hour, selectedService.durationMinutes) }}</option></select></label>
          </div>
        </section>

        <PageNotice v-if="errorMessage" title="尚未完成預約" tone="warning">{{ errorMessage }}</PageNotice>
        <div class="booking-actions">
          <button class="button button-dark" type="submit" :disabled="!canContinue || authState.loading">
            確認預約資料
          </button>
        </div>
      </form>

      <section v-if="step === 'confirm'" class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="confirm-card">
          <button class="confirm-close" type="button" aria-label="返回修改" @click="step = 'details'">← 返回修改</button>
          <p class="eyebrow">CONFIRM YOUR BOOKING</p>
          <h2 id="confirm-title">請確認預約資料</h2>
          <dl class="confirm-details">
            <div><dt>服務項目</dt><dd>{{ selectedService && selectedService.name }}</dd></div>
            <div><dt>預約日期</dt><dd>{{ selectedDate }}</dd></div>
            <div><dt>預約時段</dt><dd>{{ formatHour(selectedHour) }}–{{ formatEndHour(selectedHour, selectedService && selectedService.durationMinutes) }}</dd></div>
            <div><dt>施作時間</dt><dd>{{ selectedService && formatDuration(Math.max(0, Number(selectedService.durationMinutes) - 30)) }}</dd></div>
            <div v-if="selectedAddOns.length"><dt>加購項目</dt><dd>{{ selectedAddOnSummary }}</dd></div>
            <div><dt>合計價格</dt><dd>{{ Number(selectedService && selectedService.price) === 0 ? '私訊報價' : `NT$ ${selectedTotalPrice}` }}</dd></div>
            <div><dt>預約狀態</dt><dd>待確認</dd></div>
          </dl>
          <p class="confirm-note">預約送出後無法由會員自行取消；如需取消，請聯絡店家管理員。</p>
          <p v-if="!authState.user" class="confirm-note">按下「送出預約」後會先開啟 Google 登入；登入成功回到此頁後，請再次按下「送出預約」完成預約。</p>
          <PageNotice v-if="errorMessage" tone="warning">{{ errorMessage }}</PageNotice>
          <button class="button button-dark confirm-submit" type="button" :disabled="submitting" @click="submitBooking">
            {{ submitting ? '正在送出…' : '送出預約' }}
          </button>
        </div>
      </section>

      <section v-if="showLoginPrompt" class="login-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="login-prompt-title">
        <div class="login-prompt-card">
          <button class="confirm-close" type="button" aria-label="返回" @click="showLoginPrompt = false">← 返回</button>
          <p class="eyebrow">MEMBER SIGN IN</p>
          <h2 id="login-prompt-title">請登入後再預約</h2>
          <p>登入後會回到預約確認頁，保留目前選擇的服務與時段；請再次按下「送出預約」完成預約。</p>
          <PageNotice v-if="errorMessage" tone="warning">{{ errorMessage }}</PageNotice>
          <button class="button button-dark confirm-submit" type="button" :disabled="submitting" @click="loginAndReturn">
            使用 Google 登入
          </button>
        </div>
      </section>
    </template>
    <router-link class="text-link" to="/">返回首頁</router-link>
  </main>
</template>

<script>
import PageNotice from '../components/PageNotice.vue'
import QRCode from 'qrcode'
import { authState, signInWithGoogle } from '../services/auth'
import { getServices } from '../services/catalog'
import {
  createBooking,
  getAvailableStartHours,
  getMonthlyAvailability,
  getBookingSettings,
  getTaipeiDateString
} from '../services/bookings'
import { auth, firebaseConfigured } from '../services/firebase'
import formatDuration from '../utils/formatDuration'

export default {
  name: 'BookingPage',
  components: { PageNotice },
  data () {
    const today = getTaipeiDateString()
    const todayParts = today.split('-').map(Number)
    return {
      authState,
      firebaseConfigured,
      today,
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
      calendarYear: todayParts[0],
      calendarMonth: todayParts[1],
      availabilityByDate: {},
      availabilityMonthKey: '',
      calendarRequestId: 0,
      services: [],
      settings: null,
      selectedServiceId: '',
      selectedAddOnQuantities: {},
      selectedDate: '',
      selectedHour: null,
      loadingCatalog: true,
      loadingCalendar: false,
      calendarError: '',
      catalogError: '',
      errorMessage: '',
      submitting: false,
      showLoginPrompt: false,
      bookingId: '',
      lineQrCode: '',
      step: 'details'
    }
  },
  computed: {
    selectedService () {
      return this.services.find(service => service.id === this.selectedServiceId) || null
    },
    selectedAddOns () {
      if (!this.selectedService) return []
      return (this.selectedService.addOns || [])
        .map(addon => ({ ...addon, quantity: this.addonQuantity(addon.id) }))
        .filter(addon => addon.quantity > 0)
    },
    selectedTotalPrice () {
      return Number(this.selectedService && this.selectedService.price || 0) + this.selectedAddOns.reduce((total, addon) => total + Number(addon.price || 0) * addon.quantity, 0)
    },
    lineMessageUrl () {
      const lineId = '@340zmevl'
      const memberProfile = this.authState.memberProfile
      if (!lineId || !memberProfile || !this.selectedService || this.selectedHour === null) return ''

      const bookingMessage = [
        '您好，我已完成線上預約，資料如下：',
        `姓名：${memberProfile.customerName}`,
        `電話：${memberProfile.phone}`,
        `預約日期：${this.selectedDate}`,
        `預約時間：${this.formatHour(this.selectedHour)}–${this.formatEndHour(this.selectedHour, this.selectedService.durationMinutes)}`,
        `預約項目：${this.selectedService.name}${this.selectedAddOns.length ? `（加購：${this.selectedAddOnSummary}）` : ''}`
      ].join('\n')

      return `https://line.me/R/oaMessage/${encodeURIComponent(lineId)}/?${encodeURIComponent(bookingMessage)}`
    },
    selectedAddOnSummary () {
      return this.selectedAddOns.map(addon => `${addon.name} × ${addon.quantity}（+NT$ ${Number(addon.price) * addon.quantity}）`).join('、')
    },
    calendarMonthKey () {
      return `${this.calendarYear}-${String(this.calendarMonth).padStart(2, '0')}`
    },
    calendarMonthLabel () {
      return new Intl.DateTimeFormat('zh-TW', { timeZone: 'UTC', year: 'numeric', month: 'long' })
        .format(new Date(Date.UTC(this.calendarYear, this.calendarMonth - 1, 1)))
    },
    canGoToPreviousMonth () {
      const [todayYear, todayMonth] = this.today.split('-').map(Number)
      return this.calendarYear > todayYear || (this.calendarYear === todayYear && this.calendarMonth > todayMonth)
    },
    calendarCells () {
      const firstWeekday = new Date(Date.UTC(this.calendarYear, this.calendarMonth - 1, 1)).getUTCDay()
      const daysInMonth = new Date(Date.UTC(this.calendarYear, this.calendarMonth, 0)).getUTCDate()
      const cells = Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, date: '' }))
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${this.calendarMonthKey}-${String(day).padStart(2, '0')}`
        cells.push({ date, day, status: this.calendarDateStatus(date) })
      }
      while (cells.length % 7 !== 0) cells.push({ key: `empty-${cells.length}`, date: '' })
      return cells
    },
    selectedAvailableHours () {
      return this.availableHoursForDate(this.selectedDate)
    },
    canContinue () {
      return Boolean(this.selectedService && this.selectedDate && this.selectedHour !== null && !this.loadingCalendar)
    }
  },
  watch: {
    selectedServiceId () {
      this.selectedAddOnQuantities = {}
      this.selectedHour = null
      this.errorMessage = ''
      if (this.selectedDate && this.availableHoursForDate(this.selectedDate).length === 0) this.selectedDate = ''
    }
  },
  async created () {
    if (!this.firebaseConfigured) {
      this.loadingCatalog = false
      return
    }
    try {
      const [services, settings] = await Promise.all([getServices(), getBookingSettings()])
      this.services = services
      this.settings = settings
      this.selectedServiceId = services.length ? services[0].id : ''
      if (settings.configured && services.length) await this.loadCalendarAvailability()
    } catch (error) {
      this.catalogError = '請確認 Firestore 已啟用、安全規則已部署，且店家已建立公開服務資料。'
    } finally {
      this.loadingCatalog = false
    }
  },
  methods: {
    formatDuration,
    async generateLineQrCode () {
      if (!this.lineMessageUrl) return
      try {
        this.lineQrCode = await QRCode.toDataURL(this.lineMessageUrl, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 220
        })
      } catch (error) {
        this.lineQrCode = ''
      }
    },
    addonQuantity (addonId) {
      return Number(this.selectedAddOnQuantities[addonId]) || 0
    },
    getAddonQuantityOptions () {
      return Array.from({ length: 10 }, (_, index) => index + 1)
    },
    setAddonChecked (addonId, checked) {
      this.$set(this.selectedAddOnQuantities, addonId, checked ? 1 : 0)
    },
    setAddonQuantity (addonId, value) {
      const quantity = Number(value) || 0
      this.$set(this.selectedAddOnQuantities, addonId, Math.min(quantity, 10))
    },
    calendarDateStatus (date) {
      if (Array.isArray(this.settings.openMonths) && !this.settings.openMonths.includes(Number(date.slice(0, 7).replace('-', '')))) return 'unopened'
      if (date < this.today) return 'unavailable'
      if (this.availabilityMonthKey !== this.calendarMonthKey) return 'loading'
      const availability = this.availabilityByDate[date] || { locks: [], blocked: false }
      if (availability.blocked) return 'holiday'
      if (this.availableHoursForDate(date).length > 0) return 'available'
      const possibleHours = getAvailableStartHours(date, this.selectedService, [], this.settings)
      return possibleHours.length > 0 && availability.locks.length > 0 ? 'full' : 'unavailable'
    },
    calendarDateLabel (status) {
      if (status === 'available') return '可預約'
      if (status === 'full') return '預約已滿'
      if (status === 'holiday') return '休假日'
      if (status === 'unopened') return '尚未開放'
      if (status === 'loading') return '讀取中'
      return '不可預約'
    },
    availableHoursForDate (date) {
      if (!date || !this.selectedService || !this.settings) return []
      const availability = this.availabilityByDate[date] || { locks: [], blocked: false }
      if (availability.blocked) return []
      return getAvailableStartHours(date, this.selectedService, availability.locks, this.settings)
    },
    async loadCalendarAvailability () {
      const year = this.calendarYear
      const month = this.calendarMonth
      const requestId = this.calendarRequestId + 1
      this.calendarRequestId = requestId
      this.loadingCalendar = true
      this.calendarError = ''
      this.errorMessage = ''
      if (!this.firebaseConfigured || !this.settings || !this.settings.configured) {
        this.loadingCalendar = false
        return
      }
      try {
        const monthKey = Number(`${year}${String(month).padStart(2, '0')}`)
        if (Array.isArray(this.settings.openMonths) && !this.settings.openMonths.includes(monthKey)) {
          if (requestId !== this.calendarRequestId) return
          this.availabilityByDate = {}
          this.availabilityMonthKey = `${year}-${String(month).padStart(2, '0')}`
          return
        }
        const availability = await getMonthlyAvailability(year, month)
        if (requestId !== this.calendarRequestId) return
        this.availabilityByDate = availability
        this.availabilityMonthKey = `${year}-${String(month).padStart(2, '0')}`
      } catch (error) {
        if (requestId === this.calendarRequestId) this.calendarError = '無法讀取本月預約狀況，請確認 Firestore 規則與索引已部署後重試。'
      } finally {
        if (requestId === this.calendarRequestId) this.loadingCalendar = false
      }
    },
    changeMonth (offset) {
      const nextMonth = new Date(Date.UTC(this.calendarYear, this.calendarMonth - 1 + offset, 1))
      this.calendarYear = nextMonth.getUTCFullYear()
      this.calendarMonth = nextMonth.getUTCMonth() + 1
      this.selectedDate = ''
      this.selectedHour = null
      this.loadCalendarAvailability()
    },
    selectCalendarDate (date) {
      if (this.calendarDateStatus(date) !== 'available') return
      this.selectedDate = date
      this.selectedHour = null
      this.errorMessage = ''
    },
    formatHour (hour) {
      return `${String(hour).padStart(2, '0')}:00`
    },
    formatEndHour (hour, duration) {
      if (hour === null || !duration) return ''
      const totalMinutes = hour * 60 + Number(duration)
      const endHour = Math.floor(totalMinutes / 60)
      const minute = String(totalMinutes % 60).padStart(2, '0')
      return `${String(endHour).padStart(2, '0')}:${minute}`
    },
    continueToConfirm () {
      this.errorMessage = ''
      this.step = 'confirm'
    },
    async submitBooking (user) {
      if (!this.selectedService) {
        this.step = 'details'
        this.errorMessage = '預約資料不完整，請重新確認後再送出。'
        return
      }
      const bookingUser = user && typeof user.uid === 'string' && user.uid
        ? user
        : auth.currentUser
      if (!bookingUser || typeof bookingUser.uid !== 'string' || !bookingUser.uid) {
        this.errorMessage = ''
        this.showLoginPrompt = true
        return
      }
      const memberProfile = authState.memberProfile
      if (!memberProfile || !memberProfile.customerName || !memberProfile.phone) {
        this.errorMessage = '請先完成會員姓名與電話設定，再送出預約。'
        return
      }
      const bookingMember = { ...bookingUser, customerName: memberProfile.customerName, customerPhone: memberProfile.phone }
      this.submitting = true
      this.errorMessage = ''
      try {
        this.bookingId = await createBooking({
          user: bookingMember,
          service: this.selectedService,
          date: this.selectedDate,
          startHour: this.selectedHour,
          designCategory: '未指定',
          designWork: null,
          selectedAddOnQuantities: this.selectedAddOns.reduce((quantities, addon) => {
            quantities[addon.id] = addon.quantity
            return quantities
          }, {}),
          settings: this.settings
        })
        this.step = 'success'
        this.generateLineQrCode()
      } catch (error) {
        const isConflict = error.code === 'aborted' || error.code === 'permission-denied'
        const message = isConflict
          ? '這個時段可能剛被預約或預約條件已更新，請重新載入時段後再選擇。'
          : (error.message || '預約送出失敗，請重新確認資料後再試。')
        this.errorMessage = message
        if (isConflict || message.includes('時段剛被預約走')) {
          this.step = 'details'
          await this.loadCalendarAvailability()
          this.errorMessage = message
        }
      } finally {
        this.submitting = false
      }
    },
    async loginAndReturn () {
      this.errorMessage = ''
      try {
        const signedInUser = await signInWithGoogle()
        const user = auth.currentUser || signedInUser
        if (!user || typeof user.uid !== 'string' || !user.uid) {
          this.errorMessage = '尚未完成登入，請使用 Google 帳號登入後再預約。'
          return
        }
        this.showLoginPrompt = false
      } catch (error) {
        this.errorMessage = error.message || 'Google 登入失敗，請稍後重試。'
      }
    }
  }
}
</script>

<style scoped>
.booking-page{width:min(860px,88%);min-height:70vh;margin:0 auto;padding:42px 0 90px}
.back-home{display:inline-block;margin-bottom:38px;color:var(--muted);font-size:14.666px}
.booking-heading{text-align:center;margin-bottom:38px}.booking-heading .eyebrow{margin-bottom:12px}.booking-heading h1{margin:0 0 12px;font:400 clamp(28px,5vw,42px)/1.5 var(--serif);letter-spacing:.08em}.booking-heading>p:last-child{margin:0;color:var(--muted);font-size:14.666px;line-height:1.9}
.booking-progress{display:flex;align-items:center;justify-content:center;gap:13px;margin:0 0 40px;color:#b5aaa3;font-size:14.666px}.booking-progress span{white-space:nowrap}.booking-progress small{display:block;margin-top:5px;font-size:12.666px}.booking-progress span.active{color:#9c7264}.booking-progress i{width:55px;height:1px;background:var(--line)}
.loading-state{padding:34px 0;color:var(--muted);font-size:15.666px}
.form-section{padding:30px 0;border-top:1px solid var(--line)}.form-section-heading{display:flex;gap:16px;margin-bottom:22px}.form-section-heading>span{color:#a98476;font:14.666px var(--sans)}.form-section-heading h2{margin:0 0 7px;font:400 20px var(--serif)}.form-section-heading p{margin:0;color:var(--muted);font-size:13.666px;line-height:1.8}
.service-options{display:grid;gap:10px}.service-option{position:relative;display:flex;align-items:center;gap:13px;padding:17px 18px;border:1px solid var(--line);background:var(--paper);cursor:pointer}.service-option.selected{border-color:#ae8779;background:#fcf8f4}.service-option input{position:absolute;opacity:0}.radio-mark{width:17px;height:17px;border:1px solid #b7a79e;border-radius:50%;flex:0 0 auto}.service-option.selected .radio-mark{border:5px solid #a77f70}.service-option-copy{display:grid;gap:6px;flex:1;min-width:0}.service-option-copy strong,.service-option-meta strong{font-size:16px;font-weight:500}.service-option-copy small,.service-option-meta small{color:var(--muted);font-size:14px}.service-option-meta{display:grid;gap:6px;text-align:right}
.style-options{display:flex;flex-wrap:wrap;gap:8px}.style-options button{padding:9px 14px;border:1px solid var(--line);border-radius:24px;background:transparent;color:#756a64;font:13.666px var(--sans);cursor:pointer}.style-options button.selected{border-color:var(--ink);background:var(--ink);color:#fff}.design-works{display:flex;gap:12px;overflow-x:auto;margin-top:17px;padding:3px 0 10px}.design-work{min-width:112px;padding:8px;border:1px solid transparent;background:transparent;text-align:left;cursor:pointer}.design-work.selected{border-color:#ae8779;background:#fcf8f4}.design-art{display:grid;place-items:center;width:96px;height:108px;background:linear-gradient(145deg,#eadbd2,#c29b8c) center/cover;border-radius:2px;color:#fff;text-align:center;font-size:12.666px}.design-art--none{background:linear-gradient(145deg,#f3ebe4,#dfcec3);color:#a4796b;font-size:24px}.design-work strong{display:block;overflow:hidden;margin-top:8px;color:var(--ink);font-size:12.666px;font-weight:400;text-overflow:ellipsis;white-space:nowrap}.style-hint{margin:14px 0 0;color:var(--muted);font-size:12.666px;line-height:1.8}
.date-field{display:grid;gap:9px;width:min(280px,100%);font-size:13.666px}.date-field input{min-height:42px;padding:9px 11px;border:1px solid var(--line);background:#fffdfa;color:var(--ink);font:14.666px var(--sans)}.time-picker{margin-top:24px}.time-picker-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.time-picker-heading strong{font-size:14.666px;font-weight:500}.time-picker-heading button{border:0;background:none;color:#9d7669;font:13.666px var(--sans);cursor:pointer}.time-options{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.time-options button{min-height:42px;border:1px solid var(--line);background:#fffdfa;color:var(--ink);font:14.666px var(--sans);cursor:pointer}.time-options button.selected{border-color:var(--ink);background:var(--ink);color:white}.availability-message{padding:20px;background:var(--cream);color:var(--muted);font-size:14.666px;text-align:center}
.calendar-panel{width:min(560px,100%);padding:18px;border:1px solid var(--line);background:#fffdfa}.calendar-toolbar{display:grid;grid-template-columns:40px 1fr 40px auto;align-items:center;gap:10px}.calendar-toolbar>strong{text-align:center;font:16px var(--serif);font-weight:400}.calendar-toolbar button{min-height:36px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:20px var(--sans);cursor:pointer}.calendar-toolbar button:disabled{opacity:.4;cursor:default}.calendar-toolbar .calendar-refresh{padding:0 11px;font:13.666px var(--sans)}.calendar-legend{display:flex;flex-wrap:wrap;gap:10px 18px;margin:16px 0;color:var(--muted);font-size:12.666px}.calendar-legend>span{display:flex;align-items:center;gap:7px}.legend-dot{width:10px;height:10px;border-radius:50%;flex:0 0 auto}.legend-dot--available{background:#7f9b78}.legend-dot--unavailable,.legend-dot--holiday,.legend-dot--full{background:#c77b72}.legend-dot--unopened{background:#a9a19b}.calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}.calendar-weekdays{margin-bottom:6px;text-align:center;color:var(--muted);font-size:12.666px}.calendar-weekdays span{padding:7px 0}.calendar-day{display:grid;place-content:center;gap:4px;min-height:58px;padding:5px 2px;border:1px solid transparent;border-radius:3px;font-family:var(--sans);cursor:pointer}.calendar-day>span{font-size:15.666px}.calendar-day--available{background:#eaf1e7;color:#4e6e4b}.calendar-day--unavailable,.calendar-day--holiday,.calendar-day--full{background:#f6e9e7;color:#a55e56;cursor:not-allowed}.calendar-day--unopened{background:#eeeae6;color:#756b64;cursor:not-allowed}.calendar-day--loading{background:#f4f0ec;color:#a49a93;cursor:wait}.calendar-day.selected{border-color:#536f50;box-shadow:inset 0 0 0 1px #536f50}.calendar-empty{min-height:58px}.calendar-loading{margin:12px 0 0;color:var(--muted);font-size:12.666px;text-align:center}.time-select-field{display:grid;gap:9px;width:min(330px,100%);font-size:13.666px}.time-select-field select{min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:0;background:#fffdfa;color:var(--ink);font:14.666px var(--sans)}.time-select-field select:focus{outline:2px solid #a4796b;outline-offset:2px}
.booking-actions{display:flex;align-items:center;justify-content:flex-end;gap:18px;margin-top:28px}.booking-actions .button{border:0;cursor:pointer}.booking-actions .button:disabled,.confirm-submit:disabled{opacity:.45;cursor:not-allowed}.booking-login{margin-right:auto}.text-link{display:inline-block;margin-top:30px;font-size:14.666px}.text-link span{margin-left:8px}
.confirm-overlay,.login-prompt-overlay{position:fixed;inset:0;z-index:25;display:grid;place-items:center;overflow:auto;padding:24px;background:rgba(35,29,26,.7)}.login-prompt-overlay{z-index:30}.confirm-card,.login-prompt-card{width:min(560px,100%);max-height:calc(100vh - 48px);overflow:auto;padding:25px;background:var(--paper)}.login-prompt-card{width:min(420px,100%);text-align:center}.confirm-close{display:block;margin:0 0 24px;padding:0;border:0;background:none;color:var(--muted);font:13.666px var(--sans);cursor:pointer}.confirm-card .eyebrow,.login-prompt-card .eyebrow{margin-bottom:10px}.confirm-card h2,.login-prompt-card h2{margin:0 0 20px;font:400 24px var(--serif)}.login-prompt-card>p:not(.eyebrow){margin:0 0 24px;color:var(--muted);font-size:14.666px;line-height:1.8}.confirm-details{margin:0;border-top:1px solid var(--line)}.confirm-details div{display:grid;grid-template-columns:100px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:14.666px}.confirm-details dt{color:var(--muted)}.confirm-details dd{margin:0}.confirm-note{margin:18px 0;color:var(--muted);font-size:12.666px;line-height:1.8}.confirm-submit{width:100%;border:0;cursor:pointer}
.booking-success{padding:44px 22px;text-align:center;background:var(--cream)}.success-mark{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 18px;border:1px solid #a98578;border-radius:50%;color:#8d6b5e;font-size:21px}.booking-success .eyebrow{margin-bottom:8px}.booking-success h2{margin:0 0 12px;font:400 28px var(--serif)}.booking-success>p:not(.eyebrow){color:var(--muted);font-size:14.666px;line-height:1.9}.booking-number{display:grid;gap:8px;margin:24px auto;width:min(360px,100%);padding:16px;background:var(--paper)}.booking-number span{color:var(--muted);font-size:12.666px}.booking-number strong{overflow-wrap:anywhere;font:15.666px var(--sans);letter-spacing:.04em}.booking-success .button{margin-top:8px}
@media(max-width:600px){.booking-page{padding-top:30px}.back-home{margin-bottom:28px}.booking-heading{margin-bottom:30px}.booking-progress{gap:8px;margin-bottom:28px}.booking-progress i{width:24px}.booking-progress small{font-size:11.666px}.form-section{padding:24px 0}.form-section-heading{gap:11px}.form-section-heading h2{font-size:18px}.service-option{gap:9px;padding:14px 10px}.service-option-copy strong,.service-option-meta strong{font-size:15px}.service-option-copy small{width:100%;max-width:none;line-height:1.6}.service-option-meta small{font-size:13px}.calendar-panel{padding:12px}.calendar-toolbar{grid-template-columns:34px 1fr 34px auto;gap:6px}.calendar-toolbar button{min-height:34px}.calendar-toolbar .calendar-refresh{padding:0 8px}.calendar-weekdays,.calendar-grid{gap:3px}.calendar-day,.calendar-empty{min-height:50px}.calendar-day>span{font-size:14.666px}.calendar-legend{gap:10px 12px}.booking-actions{align-items:stretch;flex-direction:column-reverse}.booking-login{margin:0}.confirm-overlay{padding:12px}.confirm-card{max-height:calc(100vh - 24px);padding:18px}.confirm-details div{grid-template-columns:82px 1fr}.booking-success{padding:35px 14px}}
.line-booking-link{display:none;margin-top:8px}.line-booking-qr{display:grid;justify-items:center;gap:8px;margin:18px auto}.line-booking-qr img{display:block;width:220px;height:220px;padding:8px;background:#fff}.line-booking-qr p,.booking-success .line-booking-note{margin:4px auto 0;color:#514943;font-size:17px;font-weight:500;line-height:1.8}
@media(max-width:760px){.line-booking-link{display:inline-flex}.line-booking-qr{display:none}}
.calendar-day--empty{visibility:hidden;min-height:58px}
.addon-selection{display:grid;gap:8px;margin-top:18px}.addon-selection h3{margin:0 0 2px;font:16.333px var(--serif);font-weight:400}.addon-option{display:grid;grid-template-columns:minmax(0,1fr) 90px;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--line);background:#fffdfa;font-size:15px}.addon-option-check{display:flex;align-items:center;gap:10px;min-width:0;cursor:pointer}.addon-option-check input{width:16px;height:16px;accent-color:#927064}.addon-option-check span{flex:1}.addon-option-check strong{font-size:15px;font-weight:500;white-space:nowrap}.addon-option select{width:100%;min-height:36px;padding:6px 8px;border:1px solid var(--line);background:#fff;color:var(--ink);font:15px var(--sans)}.addon-option select:disabled{opacity:.55}
</style>
