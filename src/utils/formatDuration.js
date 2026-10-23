export default function formatDuration (minutes) {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  if (hours === 0) return `${remainingMinutes} 分鐘`
  if (remainingMinutes === 0) return `${hours} 小時`
  return `${hours} 小時 ${remainingMinutes} 分鐘`
}
