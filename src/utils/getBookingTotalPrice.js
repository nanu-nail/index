export default function getBookingTotalPrice (booking) {
  if (booking && booking.totalPrice !== undefined && booking.totalPrice !== null) {
    return Number(booking.totalPrice) || 0
  }
  const basePrice = Number(booking && booking.price) || 0
  const addOnTotal = (booking && Array.isArray(booking.selectedAddOns) ? booking.selectedAddOns : [])
    .reduce((total, addon) => total + (Number(addon.price) || 0), 0)
  return basePrice + addOnTotal
}

export function getBookingAddOnSummary (booking) {
  const quantities = new Map()
  const selectedAddOns = booking && Array.isArray(booking.selectedAddOns) ? booking.selectedAddOns : []
  selectedAddOns.forEach((addon) => {
    const current = quantities.get(addon.id) || { name: addon.name, price: Number(addon.price) || 0, quantity: 0 }
    current.quantity += 1
    quantities.set(addon.id, current)
  })
  return [...quantities.values()]
    .map(addon => `${addon.name} × ${addon.quantity}（+NT$ ${addon.price * addon.quantity}）`)
    .join('、')
}
