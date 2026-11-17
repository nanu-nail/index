const assert = require('assert').strict
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { transformSync } = require('@babel/core')
const Vue = require('vue')
const compiler = require('vue-template-compiler')

function load (file, mocks = {}, vueFile = false) {
  const filename = path.resolve(__dirname, '..', file)
  const source = fs.readFileSync(filename, 'utf8')
  const script = vueFile ? compiler.parseComponent(source).script.content : source
  if (vueFile) assert.deepEqual(compiler.compile(compiler.parseComponent(source).template.content).errors, [])
  const code = transformSync(script, { babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, Date, Intl, require: name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name]
    throw new Error(`Unexpected dependency: ${name}`)
  } }, { filename })
  return module.exports
}

const prices = load('src/utils/getBookingTotalPrice.js')
const income = load('src/utils/bookingIncome.js', { './getBookingTotalPrice': prices })
const plain = value => JSON.parse(JSON.stringify(value))
assert.equal(income.getBookingMonthRange('2030-12').start.toISOString(), '2030-11-30T16:00:00.000Z')
assert.equal(income.getBookingMonthRange('2030-12').end.toISOString(), '2030-12-31T16:00:00.000Z')
assert.equal(income.getBookingMonthRange('2028-02').end.toISOString(), '2028-02-29T16:00:00.000Z')
for (const value of ['', '2030-00', '2030-13', '2030-1', 'bad', '0001-01']) assert.throws(() => income.getBookingMonthRange(value))
assert.equal(income.getBookingIncomeAmount({ price: 1000, selectedAddOns: [{ price: 100 }, { price: 100 }, { price: 50 }] }), 1250)
assert.equal(income.getBookingIncomeAmount({ price: 1000, totalPrice: 900, selectedAddOns: [{ price: 100 }] }), 900, 'final price includes add-ons already')
assert.equal(income.getBookingIncomeAmount({ price: 0, selectedAddOns: [{ price: 300 }] }), null, 'unknown base quote is not just add-on income')
assert.equal(income.getBookingIncomeAmount({ price: 0, totalPrice: 1500 }), 1500)
assert.equal(income.getBookingIncomeAmount({ price: 1000, totalPrice: 0 }), null, 'zero final amount keeps existing quote semantics')
assert.equal(income.getBookingIncomeAmount({}), null)
const sample = [
  { status: 'completed', price: 1000, selectedAddOns: [{ price: 200 }] },
  { status: 'completed', price: 1000, totalPrice: 900 },
  { status: 'completed', price: 0, selectedAddOns: [{ price: 100 }] },
  { status: 'pending', price: 800 },
  { status: 'confirmed', price: 700, totalPrice: 600 },
  { status: 'confirmed', price: 0 },
  { status: 'cancelled', price: 9999 },
  { status: 'unknown', price: 8888 }
]
assert.deepEqual(plain(income.summarizeBookingIncome(sample)), {
  completedIncome: 2100, projectedIncome: 1400, completedCount: 3, projectedCount: 3,
  cancelledCount: 1, completedUnpricedCount: 1, projectedUnpricedCount: 1
})
assert.equal(income.summarizeBookingIncome([]).completedIncome, 0)

async function checkQueryAndPage () {
  const calls = []
  const timestamp = milliseconds => ({ toMillis: () => milliseconds })
  const service = load('src/services/bookings.js', {
    'firebase/firestore': {
      collection: (db, name) => name,
      where: (...args) => { calls.push(args); return args },
      orderBy: (...args) => args,
      query: (...args) => args,
      getDocs: async () => ({ docs: [
        { id: 'morning', data: () => ({ date: timestamp(1), startHour: 10 }) },
        { id: 'later-day', data: () => ({ date: timestamp(2), startHour: 10 }) },
        { id: 'afternoon', data: () => ({ date: timestamp(1), startHour: 14 }) }
      ] })
    },
    './firebase': { firebaseConfigured: true, db: {} },
    '../utils/bookingClosures': {},
    '../utils/bookingIncome': income
  })
  const records = await service.getBookingsByMonth('2030-12')
  assert.deepEqual(plain(records.map(record => record.id)), ['morning', 'afternoon', 'later-day'])
  assert.equal(calls[0][0], 'date', 'uses施作 date instead of creation date')
  assert.equal(calls[0][1], '>=')
  assert.equal(calls[0][2].toISOString(), '2030-11-30T16:00:00.000Z')
  assert.equal(calls[1][1], '<', 'next month is exclusive')

  const requests = []
  const authState = Vue.observable({ loading: false, user: { uid: 'admin' }, isAdmin: false })
  const page = load('src/views/AdminOrderHistory.vue', {
    '../components/AuthControl.vue': {}, '../components/PageNotice.vue': {},
    '../services/auth': { authState }, '../services/firebase': { firebaseConfigured: true },
    '../services/bookings': {
      getTaipeiDateString: () => '2030-12-15',
      getBookingsByMonth: month => new Promise((resolve, reject) => requests.push({ month, resolve, reject }))
    },
    '../utils/getBookingTotalPrice': prices, '../utils/bookingIncome': income
  }, true).default
  const instance = new Vue(page)
  assert.equal(requests.length, 0, 'no query without admin authorization')
  authState.isAdmin = true
  await Vue.nextTick()
  assert.equal(requests[0].month, '2030-12')
  instance.selectedMonth = '2031-01'
  await Vue.nextTick()
  assert.equal(requests[1].month, '2031-01')
  requests[0].resolve([{ id: 'stale' }])
  await new Promise(setImmediate)
  assert.equal(instance.bookings.length, 0, 'old month response is ignored')
  requests[1].resolve(sample)
  await new Promise(setImmediate)
  assert.equal(instance.bookings.length, sample.length)
  instance.statusFilter = 'completed'
  assert.equal(instance.filteredBookings.length, 3)
  assert.equal(instance.summary.projectedIncome, 1400, 'filter does not change month totals')
  instance.selectedMonth = ''
  await Vue.nextTick()
  assert.equal(instance.bookings.length, 0, 'invalid month clears old data')
  instance.selectedMonth = '2031-02'
  await Vue.nextTick()
  requests[2].reject({ code: 'permission-denied' })
  await new Promise(setImmediate)
  assert.ok(instance.error.includes('管理員權限'))
  assert.equal(instance.loading, false)
  authState.isAdmin = false
  await Vue.nextTick()
  assert.equal(instance.bookings.length, 0, 'revoking admin clears loaded data')
  instance.$destroy()
}

checkQueryAndPage().then(() => console.log('Income history checks passed: Taipei month boundaries, pricing, statuses, monthly query, filters, stale responses, admin access.')).catch(error => { console.error(error); process.exitCode = 1 })
