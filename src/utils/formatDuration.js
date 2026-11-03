export default function formatDuration (minutes) {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  return `${hours} HR ${remainingMinutes} MINS`
}
