const assert = require('assert').strict
const path = require('path')
const vm = require('vm')
const { transformFileSync } = require('@babel/core')

function load (file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file)
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-transform-modules-commonjs']
  }).code
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: name => {
      if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name]
      throw new Error(`Unexpected dependency: ${name}`)
    },
    Date,
    Intl
  }, { filename })
  return module.exports
}

const utils = load('src/utils/bookingClosures.js')
const income = load('src/utils/bookingIncome.js', { './getBookingTotalPrice': load('src/utils/getBookingTotalPrice.js') })
const plain = value => JSON.parse(JSON.stringify(value))
const range = (startMinute, endMinute) => ({ startMinute, endMinute })
const lunch = [range(720, 840)]
assert.equal(utils.overlapsClosure(600, 720, lunch), false, 'ending at closure is allowed')
assert.equal(utils.overlapsClosure(840, 960, lunch), false, 'starting at reopening is allowed')
assert.equal(utils.overlapsClosure(600, 900, lunch), true, 'service spanning the closure is blocked')
assert.equal(utils.overlapsClosure(780, 810, lunch), true, 'service inside the closure is blocked')
assert.deepEqual(plain(utils.normalizeClosureRanges([range(840, 900), range(720, 840), range(750, 800)])), [range(720, 900)])
for (const invalid of [[], [range(800, 720)], [range(-1, 720)], [range(720, 1441)], [range(720.5, 840)], Array(9).fill(range(720, 840))]) {
  assert.throws(() => utils.normalizeClosureRanges(invalid))
}
assert.deepEqual(plain(utils.remainingBusinessRanges(10, 19, lunch)), [range(600, 720), range(840, 1140)])
assert.deepEqual(plain(utils.remainingBusinessRanges(10, 19, [range(0, 1440)])), [])
assert.deepEqual(plain(utils.remainingBusinessRanges(10, 19, [range(0, 600), range(1140, 1440)])), [range(600, 1140)])
assert.deepEqual(plain(utils.remainingBusinessRanges(10, 19, [range(1020, 1200), range(700, 800)])), [range(600, 700), range(800, 1020)])

const bookings = load('src/services/bookings.js', {
  'firebase/firestore': {},
  './firebase': { firebaseConfigured: false },
  '../utils/bookingClosures': utils,
  '../utils/bookingIncome': income
})
const date = '2030-11-20'
const now = new Date('2030-11-19T00:00:00+08:00')
const settings = { openHour: 10, closeHour: 19, minStartGapHours: 4 }
const available = (duration, closures = [], locks = []) => plain(bookings.getAvailableStartHours(date, { durationMinutes: duration }, locks, settings, now, closures))
assert.deepEqual(available(120), [10, 11, 12, 13, 14, 15, 16, 17], 'existing behavior without closures')
assert.deepEqual(available(120, lunch), [10, 14, 15, 16, 17])
assert.deepEqual(available(180, lunch), [14, 15, 16], 'full duration includes add-ons')
assert.deepEqual(available(120, lunch, [14]), [10], 'existing start gap still applies')
assert.deepEqual(available(120, [range(0, 1440)]), [])
assert.deepEqual(available(241), [10, 11, 12, 13, 14], 'durations above four hours are allowed')
assert.deepEqual(available(540), [10], 'full business day is allowed')
assert.deepEqual(available(541), [], 'must still finish within business hours')
const lateSettings = { ...settings, closeHour: 23 }
assert.ok(plain(bookings.getAvailableStartHours(date, { durationMinutes: 240 }, [], lateSettings, now)).includes(19), '19:00 booking ending exactly at 23:00 is available')
assert.ok(!plain(bookings.getAvailableStartHours(date, { durationMinutes: 241 }, [], lateSettings, now)).includes(19), '19:00 booking ending after 23:00 is unavailable')
assert.equal(bookings.hasBookingTimeConflict(14, 120, [10], { 10: 900 }), true, 'long earlier booking still occupies 14:00')
assert.equal(bookings.hasBookingTimeConflict(15, 120, [10], { 10: 900 }), false, 'starting exactly at previous end is allowed')
assert.equal(bookings.hasBookingTimeConflict(10, 270, [14], { 14: 1080 }), true, 'long new booking cannot overlap a later one')
assert.equal(bookings.hasBookingTimeConflict(10, 240, [14], { 14: 1080 }), false, 'ending exactly at next start is allowed')
assert.equal(bookings.hasBookingTimeConflict(14, 120, [{ startHour: 10 }]), false, 'legacy locks without end times retain four-hour behavior')
assert.deepEqual(plain(bookings.getAvailableStartHours(date, { durationMinutes: 120 }, [10], settings, now, [], { 10: 900 })), [15, 16, 17])
assert.deepEqual(available(60, [range(630, 690)]), [12, 13, 14, 15, 16, 17, 18], 'minute-level closures')

// Compare slot generation to a minute-by-minute oracle over varying durations.
for (let duration = 30; duration <= 600; duration += 15) {
  const closures = [range(690, 795), range(1020, 1050)]
  const expected = []
  for (let hour = 10; hour < 19; hour++) {
    const start = hour * 60
    let allowed = start + duration <= 1140
    for (let minute = start; minute < start + duration; minute++) {
      if (closures.some(closed => minute >= closed.startMinute && minute < closed.endMinute)) allowed = false
    }
    if (allowed) expected.push(hour)
  }
  assert.deepEqual(available(duration, closures), expected)
}

async function checkTransactions () {
  let writes = []
  const documents = {
    'services/test': { active: true, name: 'Test', price: 100, durationMinutes: 120, addOns: [{ id: 'extra', name: 'Extra', price: 10, durationMinutes: 120, maxQuantity: 1 }] },
    'businessSettings/booking': settings
  }
  const closureId = String(new Date(`${date}T00:00:00+08:00`).getTime())
  documents[`bookingClosures/${closureId}`] = { ranges: lunch }
  const snapshot = ref => ({ exists: () => !!documents[ref], data: () => documents[ref] })
  const firestore = {
    collection: (db, name) => name,
    doc: (...args) => args.length === 1 ? 'new-booking' : args.slice(1).join('/'),
    serverTimestamp: () => 'timestamp',
    runTransaction: async (db, callback) => callback({ get: async ref => snapshot(ref), set: (ref, value) => writes.push({ ref, value }), update: (ref, value) => writes.push({ ref, value }) })
  }
  const currentBookings = load('src/services/bookings.js', {
    'firebase/firestore': firestore,
    './firebase': { firebaseConfigured: true, db: {}, auth: {} },
    '../utils/bookingClosures': utils,
    '../utils/bookingIncome': income
  })
  const request = { user: { uid: 'test-user' }, service: { id: 'test' }, date, startHour: 11, settings }
  await assert.rejects(currentBookings.createBooking(request), /關閉時段重疊/)
  assert.equal(writes.length, 0, 'rejected booking writes nothing')
  await currentBookings.createBooking({ ...request, startHour: 10 })
  assert.equal(writes.length, 2, 'ending exactly at closure books successfully')
  writes = []
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { extra: 1 } }), /關閉時段重疊/)
  assert.equal(writes.length, 0, 'current add-on duration is rechecked in transaction')
  await currentBookings.createBooking({ ...request, startHour: 14 })
  assert.equal(writes.length, 2, 'reopening boundary books successfully')
  writes = []
  documents[`bookingClosures/${closureId}`] = { ranges: [range(600, 1140)] }
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 14 }), /關閉時段重疊/)
  assert.equal(writes.length, 0, 'new closure is rechecked despite stale client options')

  delete documents[`bookingClosures/${closureId}`]
  documents['businessSettings/booking'] = lateSettings
  documents['services/test'].durationMinutes = 210
  documents['services/test'].addOns = [{ id: 'removal', name: '本店卸甲', price: 0, durationMinutes: 30, maxQuantity: 1 }]
  await currentBookings.createBooking({ ...request, startHour: 19, settings: lateSettings, selectedAddOnQuantities: { removal: 1 } })
  const closingBooking = writes.find(write => write.ref === 'new-booking').value
  assert.equal(closingBooking.durationMinutes, 240, 'three-hour service plus buffer and removal totals four hours')
  assert.equal(closingBooking.endAt.getTime(), new Date(`${date}T23:00:00+08:00`).getTime(), 'booking ending exactly at closing succeeds')
  writes = []
  documents['services/test'].durationMinutes = 211
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 19, settings: lateSettings, selectedAddOnQuantities: { removal: 1 } }))
  assert.equal(writes.length, 0, 'booking one minute beyond closing writes nothing')
  documents['businessSettings/booking'] = settings
  documents['services/test'].durationMinutes = 120
  documents['services/test'].addOns = [
    { id: 'a', name: 'A', price: 10, durationMinutes: 30, maxQuantity: 3 },
    { id: 'b', name: 'B', price: 20, durationMinutes: 60, maxQuantity: 2 }
  ]
  await currentBookings.createBooking({ ...request, startHour: 14, selectedAddOnQuantities: { a: 2, b: 1 } })
  assert.equal(writes.length, 2, 'multiple add-ons create one booking and one day update')
  const bookingWrite = writes.find(write => write.ref === 'new-booking').value
  const dayWrite = writes.find(write => write.ref.startsWith('scheduleDays/'))
  assert.equal(bookingWrite.durationMinutes, 240, 'combined duration succeeds')
  assert.equal(bookingWrite.addOnDurationMinutes, 120)
  assert.equal(bookingWrite.selectedAddOns.length, 3, 'quantities retained in snapshots')
  assert.deepEqual(plain(dayWrite.value.startHours), [14], 'all add-ons occupy only one daily place')
  writes = []
  documents[dayWrite.ref] = { startHours: [10] }
  await currentBookings.createBooking({ ...request, startHour: 14, selectedAddOnQuantities: { a: 2, b: 1 } })
  assert.deepEqual(plain(writes.find(write => write.ref === dayWrite.ref).value.startHours), [10, 14], 'second booking uses one remaining place')
  writes = []
  documents[dayWrite.ref] = { startHours: [10, 14] }
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 14, selectedAddOnQuantities: { a: 1, b: 1 } }), /預約名額已滿/)
  assert.equal(writes.length, 0, 'full day rejects without writes')
  delete documents[dayWrite.ref]
  await currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { a: 3, b: 1 } })
  assert.equal(writes.find(write => write.ref === 'new-booking').value.durationMinutes, 270, 'combined duration above 240 succeeds')
  assert.equal(writes.find(write => write.ref === dayWrite.ref).value.endMinutesByStart[10], 870, 'actual ending minute is saved')
  writes = []
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 14, selectedAddOnQuantities: { a: 4 } }), /數量上限/)
  assert.equal(writes.length, 0, 'quantity limit is still enforced')

  documents[dayWrite.ref] = { startHours: [10], endMinutesByStart: { 10: 900 } }
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 14 }), /既有預約重疊/)
  assert.equal(writes.length, 0, 'long earlier booking blocks conflicting new booking')
  await currentBookings.createBooking({ ...request, startHour: 15 })
  assert.equal(writes.find(write => write.ref === dayWrite.ref).value.endMinutesByStart[10], 900, 'existing ending time is preserved')
  writes = []
  documents[dayWrite.ref] = { startHours: [14], endMinutesByStart: { 14: 1080 } }
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { a: 3, b: 1 } }), /既有預約重疊/)
  assert.equal(writes.length, 0, 'long new booking cannot span later booking')
  await currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { a: 2, b: 1 } })
  writes = []
  delete documents[dayWrite.ref]
  documents['services/test'].durationMinutes = 300
  documents['services/test'].addOns = [{ id: 'long', name: 'Long', price: 20, durationMinutes: 300, maxQuantity: 2 }]
  await currentBookings.createBooking({ ...request, startHour: 10 })
  assert.equal(writes.find(write => write.ref === 'new-booking').value.durationMinutes, 300, 'main service above 240 succeeds')
  writes = []
  documents['services/test'].durationMinutes = 60
  await currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { long: 1 } })
  assert.equal(writes.find(write => write.ref === 'new-booking').value.durationMinutes, 360, 'individual add-on above 240 succeeds')
  writes = []
  await assert.rejects(currentBookings.createBooking({ ...request, startHour: 10, selectedAddOnQuantities: { long: 2 } }), /所選時間已無法預約/)
  assert.equal(writes.length, 0, 'unlimited duration must still fit business hours')
  documents['bookings/cancel-test'] = { userId: 'test-user', staffId: 'primary', date: new Date(`${date}T00:00:00+08:00`), startHour: 10 }
  documents[dayWrite.ref] = { startHours: [10, 16], endMinutesByStart: { 10: 900, 16: 1080 } }
  await currentBookings.setBookingStatus({ id: 'cancel-test', ...documents['bookings/cancel-test'] }, 'cancelled')
  assert.deepEqual(plain(writes.find(write => write.ref === dayWrite.ref).value.endMinutesByStart), { 16: 1080 }, 'cancelling removes only its end-time lock')
  writes = []

  let committed = 0
  const admin = load('src/services/admin.js', {
    'firebase/firestore': { ...firestore, writeBatch: () => ({ set: (ref, value) => writes.push({ ref, value }), commit: async () => { committed++ } }) },
    './firebase': { db: {} },
    './bookings': currentBookings,
    '../utils/bookingClosures': utils
  })
  await admin.saveBookingClosuresBatch({ dates: [date, date, '2030-11-21'], ranges: [range(840, 900), range(720, 840)] })
  assert.equal(committed, 1)
  assert.equal(writes.length, 2, 'batch deduplicates dates')
  assert.ok(writes.every(write => write.ref.startsWith('bookingClosures/')), 'existing collections are untouched')
  assert.deepEqual(plain(writes[0].value.ranges), [range(720, 900)])
  await assert.rejects(admin.saveBookingClosuresBatch({ dates: ['2030-02-30'], ranges: lunch }), /日期格式無效/)
  assert.equal(committed, 1, 'invalid dates do not commit')
}

checkTransactions().then(() => {
  console.log('Booking checks passed: unlimited durations, actual end-time conflicts, legacy locks, cancellation, capacities, add-ons, closures, and batch persistence.')
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
