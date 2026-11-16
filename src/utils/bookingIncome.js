import getBookingTotalPrice from './getBookingTotalPrice'

export function getBookingMonthRange (month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('請選擇有效的查詢月份。')
  const [year, monthNumber] = month.split('-').map(Number)
  if (year < 1000 || monthNumber < 1 || monthNumber > 12) throw new Error('請選擇有效的查詢月份。')
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - 8 * 3600000),
    end: new Date(Date.UTC(year, monthNumber, 1) - 8 * 3600000)
  }
}

export function getBookingIncomeAmount (booking) {
  const hasFinalPrice = booking.totalPrice !== undefined && booking.totalPrice !== null
  const price = Number(hasFinalPrice ? booking.totalPrice : booking.price)
  // A zero price means “contact the studio for a quote” throughout this app.
  if (!Number.isFinite(price) || price <= 0) return null
  const amount = getBookingTotalPrice(booking)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function summarizeBookingIncome (bookings) {
  return bookings.reduce((summary, booking) => {
    const amount = getBookingIncomeAmount(booking)
    if (booking.status === 'completed') {
      summary.completedCount += 1
      if (amount === null) summary.completedUnpricedCount += 1
      else summary.completedIncome += amount
    } else if (booking.status === 'pending' || booking.status === 'confirmed') {
      summary.projectedCount += 1
      if (amount === null) summary.projectedUnpricedCount += 1
      else summary.projectedIncome += amount
    } else if (booking.status === 'cancelled') summary.cancelledCount += 1
    return summary
  }, {
    completedIncome: 0,
    projectedIncome: 0,
    completedCount: 0,
    projectedCount: 0,
    cancelledCount: 0,
    completedUnpricedCount: 0,
    projectedUnpricedCount: 0
  })
}
