export default function formatDuration (minutes) {
  const totalMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
  const hours = Number((totalMinutes / 60).toFixed(2))
  return `${hours} HR`
}
