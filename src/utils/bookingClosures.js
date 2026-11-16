export const MAX_CLOSURE_RANGES = 8

export function overlapsClosure (startMinute, endMinute, ranges = []) {
  return ranges.some(range => startMinute < range.endMinute && endMinute > range.startMinute)
}

export function normalizeClosureRanges (ranges) {
  if (!Array.isArray(ranges) || ranges.length < 1 || ranges.length > MAX_CLOSURE_RANGES) {
    throw new Error('請設定 1 至 8 段關閉時間。')
  }
  const sorted = ranges.map(range => {
    const startMinute = Number(range.startMinute)
    const endMinute = Number(range.endMinute)
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || endMinute > 1440 || startMinute >= endMinute) {
      throw new Error('關閉結束時間必須晚於開始時間，且限於同一天。')
    }
    return { startMinute, endMinute }
  }).sort((a, b) => a.startMinute - b.startMinute)
  const merged = []
  sorted.forEach(range => {
    const previous = merged[merged.length - 1]
    if (previous && range.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, range.endMinute)
    else merged.push({ ...range })
  })
  return merged
}

export function remainingBusinessRanges (openHour, closeHour, ranges = []) {
  let available = [{ startMinute: openHour * 60, endMinute: closeHour * 60 }]
  ranges.forEach(closed => {
    available = available.flatMap(range => {
      if (!overlapsClosure(range.startMinute, range.endMinute, [closed])) return [range]
      const parts = []
      if (range.startMinute < closed.startMinute) parts.push({ startMinute: range.startMinute, endMinute: closed.startMinute })
      if (range.endMinute > closed.endMinute) parts.push({ startMinute: closed.endMinute, endMinute: range.endMinute })
      return parts
    })
  })
  return available
}

export function formatMinute (minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}
