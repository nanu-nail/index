import {
  collectionGroup,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'firebase/firestore'
import { db, firebaseConfigured } from './firebase'

export const DEFAULT_STAFF_ID = 'primary'
export const OPEN_HOUR = 10
export const CLOSE_HOUR = 19
export const MIN_START_GAP_HOURS = 4
export const DEFAULT_BOOKING_SETTINGS = Object.freeze({
  openHour: OPEN_HOUR,
  closeHour: CLOSE_HOUR,
  minStartGapHours: MIN_START_GAP_HOURS,
  timeZone: 'Asia/Taipei'
})

export function getTaipeiDateString (date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getHourlyStartOptions (openHour = OPEN_HOUR, closeHour = CLOSE_HOUR) {
  return Array.from({ length: Math.max(0, closeHour - openHour) }, (_, index) => openHour + index)
}

export function getAvailableStartHours (date, service, existingHours = [], settings = DEFAULT_BOOKING_SETTINGS, now = new Date()) {
  if (!date || !service) return []
  const duration = Number(service.durationMinutes)
  if (!Number.isInteger(duration) || duration < 1) return []
  const openingHour = Number(settings.openHour)
  const closingHour = Number(settings.closeHour)
  const minGap = Number(settings.minStartGapHours) || MIN_START_GAP_HOURS
  const closingTime = new Date(`${date}T${String(closingHour).padStart(2, '0')}:00:00+08:00`)
  return getHourlyStartOptions(openingHour, closingHour).filter((hour) => {
    const start = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+08:00`)
    const end = new Date(start.getTime() + duration * 60000)
    const gapConflict = existingHours.some(existingHour => Math.abs(existingHour - hour) < minGap)
    return start > now && end <= closingTime && !gapConflict
  })
}

function getTaipeiDateParts (date) {
  let value = date
  if (typeof date === 'string') value = new Date(`${date}T00:00:00+08:00`)
  else if (date && typeof date.toDate === 'function') value = date.toDate()
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value)
  return Object.fromEntries(parts.map(part => [part.type, String(Number(part.value))]))
}

function scheduleDayRef (staffId, date) {
  const parts = getTaipeiDateParts(date)
  return doc(db, 'scheduleDays', staffId, 'years', parts.year, 'months', parts.month, 'days', parts.day)
}

function blockedDateDocumentId (date) {
  return String(new Date(`${date}T00:00:00+08:00`).getTime())
}

export async function getAvailability (date, staffId = DEFAULT_STAFF_ID) {
  if (!firebaseConfigured) throw new Error('Firebase 尚未設定，暫時無法載入即時可預約時段。')
  const [scheduleDay, blockedDate] = await Promise.all([
    getDoc(scheduleDayRef(staffId, date)),
    getDoc(doc(db, 'blockedDates', blockedDateDocumentId(date)))
  ])
  return {
    locks: scheduleDay.exists() ? (scheduleDay.data().startHours || []).map(startHour => ({ startHour })) : [],
    blocked: blockedDate.exists() && blockedDate.data().active === true
  }
}

export async function getMonthlyAvailability (year, month, staffId = DEFAULT_STAFF_ID) {
  if (!firebaseConfigured) throw new Error('Firebase 尚未設定，暫時無法載入可預約日期。')
  const monthString = String(month).padStart(2, '0')
  const startDate = `${year}-${monthString}-01`
  const nextMonthDate = getTaipeiDateString(new Date(Date.UTC(year, month, 1)))
  const startAt = new Date(`${startDate}T00:00:00+08:00`)
  const endAt = new Date(`${nextMonthDate}T00:00:00+08:00`)
  const scheduleQuery = query(
    collectionGroup(db, 'days'),
    where('staffId', '==', staffId),
    where('date', '>=', startAt),
    where('date', '<', endAt)
  )
  const blockedQuery = query(
    collection(db, 'blockedDates'),
    where('date', '>=', startDate),
    where('date', '<', nextMonthDate)
  )
  const [scheduleResult, blockedResult] = await Promise.all([
    getDocs(scheduleQuery),
    getDocs(blockedQuery)
  ])
  const availability = {}
  scheduleResult.docs.forEach((item) => {
    const data = item.data()
    const date = getTaipeiDateString(data.date.toDate())
    availability[date] = { locks: data.startHours || [], blocked: false }
  })
  blockedResult.docs.forEach((item) => {
    const data = item.data()
    if (data.active === true) {
      availability[data.date] = {
        ...(availability[data.date] || { locks: [] }),
        blocked: true
      }
    }
  })
  return availability
}

export async function getBookingSettings () {
  if (!firebaseConfigured) return { ...DEFAULT_BOOKING_SETTINGS }
  const snapshot = await getDoc(doc(db, 'businessSettings', 'booking'))
  return snapshot.exists()
    ? { ...DEFAULT_BOOKING_SETTINGS, ...snapshot.data(), configured: true }
    : { ...DEFAULT_BOOKING_SETTINGS, configured: false }
}

export async function createBooking ({ user, service, date, startHour, designCategory, designWork, selectedAddOnQuantities = {}, settings = DEFAULT_BOOKING_SETTINGS }) {
  if (!firebaseConfigured) throw new Error('Firebase 尚未設定，無法送出預約。')
  if (!user) throw new Error('請先使用 Google 帳號登入。')
  if (!service || !Number.isInteger(startHour) || !getHourlyStartOptions(settings.openHour, settings.closeHour).includes(startHour)) {
    throw new Error('預約資料不完整，請重新選擇服務、日期與時段。')
  }

  const dateStart = new Date(`${date}T00:00:00+08:00`)
  const startAt = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00+08:00`)
  const durationMinutes = Number(service.durationMinutes)
  const endAt = new Date(startAt.getTime() + durationMinutes * 60000)
  const closeAt = new Date(`${date}T${String(settings.closeHour).padStart(2, '0')}:00:00+08:00`)
  if (!Number.isFinite(startAt.getTime()) || startAt <= new Date() || endAt > closeAt) {
    throw new Error('所選時間已過或服務無法在營業時間內完成，請重新選擇。')
  }

  const bookingRef = doc(collection(db, 'bookings'))
  const dayRef = scheduleDayRef(DEFAULT_STAFF_ID, date)
  const serviceRef = doc(db, 'services', service.id)
  const settingsRef = doc(db, 'businessSettings', 'booking')
  const blockedDateRef = doc(db, 'blockedDates', blockedDateDocumentId(date))

  await runTransaction(db, async (transaction) => {
    const [currentService, scheduleDay, currentSettingsSnapshot, blockedDateSnapshot] = await Promise.all([
      transaction.get(serviceRef),
      transaction.get(dayRef),
      transaction.get(settingsRef),
      transaction.get(blockedDateRef)
    ])

    if (blockedDateSnapshot.exists() && blockedDateSnapshot.data().active === true) {
      throw new Error('這一天已設為公休日，請重新選擇日期。')
    }

    if (!currentService.exists() || !currentService.data().active) {
      throw new Error('這項服務目前無法預約，請重新選擇。')
    }
    const currentHours = scheduleDay.exists() ? (scheduleDay.data().startHours || []) : []
    if (currentHours.some(hour => Math.abs(hour - startHour) < MIN_START_GAP_HOURS)) {
      throw new Error('這個時段剛被預約走，請重新載入時段並選擇其他時間。')
    }

    const current = currentService.data()
    const configuredAddOns = Array.isArray(current.addOns) ? current.addOns : []
    const selectedAddOns = []
    for (const [id, rawQuantity] of Object.entries(selectedAddOnQuantities || {})) {
      const quantity = Number(rawQuantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        throw new Error('每個加購選項的數量上限為 10 件，請重新選擇。')
      }
      const addon = configuredAddOns.find(option => option.id === id)
      if (!addon || !addon.name || !Number.isInteger(Number(addon.price)) || Number(addon.price) < 0) {
        throw new Error('加購選項已更新，請重新選擇後再送出。')
      }
      for (let unit = 0; unit < quantity; unit += 1) {
        selectedAddOns.push({ id: addon.id, name: addon.name, price: Number(addon.price) })
      }
    }
    const currentSettings = currentSettingsSnapshot.exists()
      ? { ...DEFAULT_BOOKING_SETTINGS, ...currentSettingsSnapshot.data() }
      : { ...DEFAULT_BOOKING_SETTINGS }
    const bookingMonth = Number(date.slice(0, 7).replace('-', ''))
    if (Array.isArray(currentSettings.openMonths) && !currentSettings.openMonths.includes(bookingMonth)) {
      throw new Error('此月份尚未開放預約，請選擇已開放的月份。')
    }
    if (!getHourlyStartOptions(currentSettings.openHour, currentSettings.closeHour).includes(startHour)) {
      throw new Error('營業時段已更新，請重新選擇可預約時間。')
    }
    const currentDuration = Number(current.durationMinutes)
    const currentCloseAt = new Date(`${date}T${String(currentSettings.closeHour).padStart(2, '0')}:00:00+08:00`)
    const currentEnd = new Date(startAt.getTime() + currentDuration * 60000)
    if (!Number.isInteger(currentDuration) || currentDuration < 1 || currentEnd > currentCloseAt || startAt <= new Date()) {
      throw new Error('服務資料有更新，所選時間已無法預約，請重新選擇。')
    }

    const nextHours = [...currentHours, startHour].sort((a, b) => a - b)
    transaction.set(dayRef, {
      staffId: DEFAULT_STAFF_ID,
      date: dateStart,
      startHours: nextHours,
      lastAction: 'book',
      lastBookingId: bookingRef.id,
      lastStartHour: startHour,
      lastUserId: user.uid,
      updatedAt: serverTimestamp()
    })
    transaction.set(bookingRef, {
      userId: user.uid,
      customerName: user.displayName || '',
      customerEmail: user.email || '',
      staffId: DEFAULT_STAFF_ID,
      date: dateStart,
      startAt,
      endAt: currentEnd,
      startHour,
      serviceId: service.id,
      serviceName: current.name,
      price: current.price,
      ...(selectedAddOns.length ? { selectedAddOns } : {}),
      durationMinutes: currentDuration,
      designCategory,
      designWorkTitle: designWork ? designWork.title : '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  })

  return bookingRef.id
}

export async function getMyBookings (userId) {
  if (!firebaseConfigured || !userId) return []
  const bookingsQuery = query(
    collection(db, 'bookings'),
    where('userId', '==', userId),
    orderBy('date', 'desc'),
    orderBy('startHour', 'desc')
  )
  const result = await getDocs(bookingsQuery)
  return result.docs.map(item => ({ id: item.id, ...item.data() }))
}

export async function getAllBookings () {
  const result = await getDocs(query(collection(db, 'bookings'), orderBy('date', 'desc')))
  return result.docs.map(item => ({ id: item.id, ...item.data() }))
}

export async function setBookingStatus (booking, status) {
  if (!['confirmed', 'cancelled', 'completed'].includes(status)) throw new Error('不支援的預約狀態。')
  const bookingRef = doc(db, 'bookings', booking.id)
  const dayRef = scheduleDayRef(booking.staffId, booking.date)

  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(bookingRef)
    if (!current.exists()) throw new Error('找不到這筆預約，請重新整理清單。')
    const data = current.data()
    const scheduleDay = status === 'cancelled' ? await transaction.get(dayRef) : null
    if (status === 'cancelled' && (!scheduleDay || !scheduleDay.exists())) {
      throw new Error('找不到這天的預約時段資料，請先聯絡系統管理員。')
    }
    const changes = { status, updatedAt: serverTimestamp() }
    if (status === 'confirmed') changes.confirmedAt = serverTimestamp()
    if (status === 'cancelled') changes.cancelledAt = serverTimestamp()
    transaction.update(bookingRef, changes)
    if (status === 'cancelled') {
      const currentHours = scheduleDay.data().startHours || []
      transaction.update(dayRef, {
        startHours: currentHours.filter(hour => hour !== data.startHour),
        lastAction: 'cancel',
        lastBookingId: bookingRef.id,
        lastStartHour: data.startHour,
        lastUserId: data.userId,
        updatedAt: serverTimestamp()
      })
    }
    return data
  })
}

