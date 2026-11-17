const http = require('http')
const assert = require('assert').strict
const fs = require('fs')
const Module = require('module')
const { transformFileSync } = require('@babel/core')
const { initializeApp } = require('firebase/app')
const firestore = require('firebase/firestore')
const projectId = 'demo-nanu'
const emulatorPort = Number(process.env.BOOKING_RULES_EMULATOR_PORT || 8086)
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: emulatorPort, path, method, headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }, res => {
      let output = ''; res.on('data', chunk => { output += chunk }); res.on('end', () => res.statusCode < 300 ? resolve(output) : reject(new Error(output)))
    })
    req.on('error', reject); req.end(JSON.stringify(body))
  })
}
function value(input) {
  if (input instanceof Date) return { timestampValue: input.toISOString() }
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } }
  if (typeof input === 'number') return { integerValue: String(input) }
  if (typeof input === 'boolean') return { booleanValue: input }
  if (typeof input === 'string') return { stringValue: input }
  return { mapValue: { fields: Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])) } }
}
function load(file, mocks) {
  const code = transformFileSync(file, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code
  const loaded = new Module(file, module)
  loaded.require = name => mocks[name]
  loaded._compile(code, file)
  return loaded.exports
}
;(async () => {
  await call('PUT', `/emulator/v1/projects/${projectId}:securityRules`, { rules: { files: [{ name: 'firestore.rules', content: fs.readFileSync('firestore.rules', 'utf8') }] } })
  await call('DELETE', `/emulator/v1/projects/${projectId}/databases/(default)/documents`)
  const date = '2026-12-01'
  const settings = { openHour: 10, closeHour: 23, openMonths: [202612] }
  const addon = { id: 'removal', name: '本店卸甲', price: 150, durationMinutes: 30, maxQuantity: 1 }
  const day = 'scheduleDays/primary/years/2026/months/12/days/1'
  const docs = {
    'businessSettings/booking': settings,
    'services/test': { active: true, name: '自由發揮', price: 1500, durationMinutes: 210, addOns: [addon] },
    'bookingCapacityOverrides/1796054400000': { date, capacity: 3 },
    [day]: { staffId: 'primary', date: new Date(`${date}T00:00:00+08:00`), startHours: [14], lastAction: 'book', lastBookingId: 'earlier', lastStartHour: 14, lastUserId: 'earlier-user', updatedAt: new Date() }
  }
  for (const [path, data] of Object.entries(docs)) await call('PATCH', `/v1/projects/${projectId}/databases/(default)/documents/${path}`, { fields: value(data).mapValue.fields })
  const db = firestore.getFirestore(initializeApp({ projectId, apiKey: 'test', appId: 'test' }))
  firestore.connectFirestoreEmulator(db, '127.0.0.1', emulatorPort, { mockUserToken: { sub: 'test-user' } })
  const closures = load('src/utils/bookingClosures.js', {})
  const bookings = load('src/services/bookings.js', { 'firebase/firestore': firestore, './firebase': { db, auth: {}, firebaseConfigured: true }, '../utils/bookingClosures': closures, '../utils/bookingIncome': {} })
  const bookingId = await bookings.createBooking({ user: { uid: 'test-user' }, service: { id: 'test' }, date, startHour: 19, designCategory: '自由發揮', designWork: null, selectedAddOnQuantities: { removal: 1 }, settings })
  const template = (await firestore.getDoc(firestore.doc(db, 'bookings', bookingId))).data()
  assert.equal(template.endAt.toDate().getTime(), new Date(`${date}T23:00:00+08:00`).getTime())
  console.log('PASS: legacy 14:00 lock plus 19:00–23:00 booking')
  async function checkRuleWrite(label, previous, durationMinutes, allowed) {
    await call('PATCH', `/v1/projects/${projectId}/databases/(default)/documents/${day}`, { fields: value(previous).mapValue.fields })
    const ref = firestore.doc(firestore.collection(db, 'bookings'))
    const batch = firestore.writeBatch(db)
    batch.set(ref, { ...template, durationMinutes, addOnDurationMinutes: durationMinutes - 210, endAt: new Date(template.startAt.toMillis() + durationMinutes * 60000), createdAt: firestore.serverTimestamp(), updatedAt: firestore.serverTimestamp() })
    batch.set(firestore.doc(db, day), { ...previous, startHours: [...previous.startHours, 19].sort((a, b) => a - b), endMinutesByStart: { ...(previous.endMinutesByStart || {}), 19: 19 * 60 + durationMinutes }, lastAction: 'book', lastBookingId: ref.id, lastStartHour: 19, lastUserId: 'test-user', updatedAt: firestore.serverTimestamp() })
    if (allowed) await batch.commit()
    else await assert.rejects(batch.commit(), error => error.code === 'permission-denied')
    console.log(`PASS: ${label}`)
  }
  await checkRuleWrite('actual earlier end exactly at 19:00 allows booking', { ...docs[day], endMinutesByStart: { 14: 1140 } }, 240, true)
  await checkRuleWrite('two legacy bookings still allow the remaining late slot', { ...docs[day], startHours: [10, 14] }, 240, true)
  await checkRuleWrite('overlap in the second occupied slot is rejected', { ...docs[day], startHours: [10, 14], endMinutesByStart: { 10: 840, 14: 1200 } }, 240, false)
  await checkRuleWrite('earlier booking ending at 20:00 rejects overlap', { ...docs[day], endMinutesByStart: { 14: 1200 } }, 240, false)
  await checkRuleWrite('one minute beyond closing is rejected', docs[day], 241, false)
  await checkRuleWrite('full daily capacity is rejected', { ...docs[day], startHours: [6, 10, 14] }, 240, false)
  await checkRuleWrite('less than four hours between starts is rejected', { ...docs[day], startHours: [16], endMinutesByStart: { 16: 1020 } }, 240, false)
  await firestore.terminate(db)
})().catch(error => { console.error(error); process.exit(1) })
