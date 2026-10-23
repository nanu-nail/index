import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_BOOKING_SETTINGS } from './bookings'

async function allDocuments (collectionName) {
  const result = await getDocs(collection(db, collectionName))
  return result.docs.map(item => ({ id: item.id, ...item.data() }))
}

export function getAllServices () {
  return allDocuments('services')
}

export function getAllWorks () {
  return allDocuments('portfolios')
}

export async function saveService (service) {
  const data = {
    name: service.name.trim(),
    description: service.description.trim(),
    price: Number(service.price),
    durationMinutes: Number(service.durationMinutes),
    addOns: (service.addOns || []).map(addon => ({
      id: String(addon.id),
      name: addon.name.trim(),
      price: Number(addon.price)
    })),
    active: Boolean(service.active),
    sortOrder: Number(service.sortOrder) || 0,
    updatedAt: serverTimestamp()
  }
  if (service.id) {
    await setDoc(doc(db, 'services', service.id), data, { merge: true })
    return service.id
  }
  const created = await addDoc(collection(db, 'services'), { ...data, createdAt: serverTimestamp() })
  return created.id
}

export async function saveWork (work) {
  const data = {
    title: work.title.trim(),
    category: work.category,
    imageURL: work.imageURL.trim(),
    alt: work.alt.trim() || work.title.trim(),
    active: Boolean(work.active),
    sortOrder: Number(work.sortOrder) || 0,
    updatedAt: serverTimestamp()
  }
  if (work.id) {
    await setDoc(doc(db, 'portfolios', work.id), data, { merge: true })
    return work.id
  }
  const created = await addDoc(collection(db, 'portfolios'), { ...data, createdAt: serverTimestamp() })
  return created.id
}

export async function getAdminBookingSettings () {
  const result = await getDoc(doc(db, 'businessSettings', 'booking'))
  return result.exists() ? result.data() : null
}

export async function saveBookingSettings (settings) {
  const openHour = Number(settings.openHour)
  const closeHour = Number(settings.closeHour)
  if (!Number.isInteger(openHour) || !Number.isInteger(closeHour) || openHour < 0 || closeHour > 23 || closeHour <= openHour) {
    throw new Error('營業結束時間必須晚於開始時間，並使用整點。')
  }
  const data = {
    ...DEFAULT_BOOKING_SETTINGS,
    openHour,
    closeHour,
    minStartGapHours: DEFAULT_BOOKING_SETTINGS.minStartGapHours,
    timeZone: DEFAULT_BOOKING_SETTINGS.timeZone,
    updatedAt: serverTimestamp()
  }
  if (Array.isArray(settings.openMonths)) {
    const openMonths = [...new Set(settings.openMonths.map(Number))].sort((a, b) => a - b)
    if (openMonths.some(month => !Number.isInteger(month) || month % 100 < 1 || month % 100 > 12 || Math.floor(month / 100) < 2000)) {
      throw new Error('開放月份資料無效，請重新選擇月份。')
    }
    data.openMonths = openMonths
  }
  await setDoc(doc(db, 'businessSettings', 'booking'), data, { merge: true })
}

export function getBlockedDates () {
  return allDocuments('blockedDates')
}

export async function saveBlockedDatesBatch ({ dates, note = '' }) {
  const uniqueDates = [...new Set(dates || [])].sort()
  if (uniqueDates.length === 0) throw new Error('請先在月曆選取公休日。')
  if (uniqueDates.length > 366 || uniqueDates.some((date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return true
    const timestamp = Date.parse(`${date}T00:00:00Z`)
    return !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date
  })) {
    throw new Error('日期無效，或一次選取超過 366 天。')
  }
  const batch = writeBatch(db)
  for (const date of uniqueDates) {
    const id = String(new Date(`${date}T00:00:00+08:00`).getTime())
    batch.set(doc(db, 'blockedDates', id), {
      date,
      note: note.trim(),
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true })
  }
  await batch.commit()
  return uniqueDates.length
}

export async function deleteBlockedDate (id) {
  await deleteDoc(doc(db, 'blockedDates', id))
}
