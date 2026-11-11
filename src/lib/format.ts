const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** 2026년 11월 12일 */
export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso))
}

/** 2026년 11월 12일 오후 3:05 */
export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso))
}
