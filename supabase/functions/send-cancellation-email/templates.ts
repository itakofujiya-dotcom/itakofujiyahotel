import { escapeHtml } from '../_shared/email-safety.ts'
import type {
  CancellationNotificationSnapshot,
  EmailMessage,
  NotificationLocale,
} from '../_shared/notification-types.ts'

export function buildCancellationEmail(
  snapshot: CancellationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  return snapshot.recipientKind === 'hotel'
    ? buildHotelCancellationNotification(snapshot, senderEmail, senderName)
    : buildCustomerCancellationConfirmation(snapshot, senderEmail, senderName)
}

export function buildCustomerCancellationConfirmation(
  snapshot: CancellationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  const locale = snapshot.locale === 'ko' ? 'ko' : 'ja'
  const ko = locale === 'ko'
  const hotelName =
    (ko ? snapshot.hotel.nameKo : snapshot.hotel.nameJa) ||
    snapshot.hotel.nameJa
  const automatic =
    snapshot.cancellationReason === 'bank_transfer_payment_expired'
  const subject = automatic
    ? ko
      ? `[${hotelName}] 미입금으로 예약이 자동 취소되었습니다 (예약번호: ${snapshot.reservationNumber})`
      : `【${hotelName}】ご予約を自動キャンセルしました（予約番号: ${snapshot.reservationNumber}）`
    : ko
      ? `[${hotelName}] 예약 취소가 완료되었습니다 (예약번호: ${snapshot.reservationNumber})`
      : `【${hotelName}】ご予約のキャンセルを承りました（予約番号: ${snapshot.reservationNumber}）`
  const refundNotice = customerRefundNotice(snapshot, locale)
  const roomList = snapshot.rooms
    .map((room, index) => {
      const name =
        (ko ? room.roomTypeNameKo : room.roomTypeNameJa) || room.roomTypeNameJa
      return `${ko ? '객실' : '客室'} ${index + 1}: ${name}`
    })
    .join('\n')

  const rows: Array<[string, string]> = [
    [ko ? '예약번호' : '予約番号', snapshot.reservationNumber],
    [ko ? '예약자명' : 'ご予約者名', snapshot.guest.name],
    [ko ? '체크인' : 'チェックイン', formatDate(snapshot.checkIn, locale)],
    [ko ? '체크아웃' : 'チェックアウト', formatDate(snapshot.checkOut, locale)],
    [
      ko ? '취소일' : 'キャンセル日時',
      formatTokyoDateTime(snapshot.cancelledAt, locale),
    ],
    [
      ko ? '결제 방법' : 'お支払い方法',
      paymentMethodLabel(snapshot.payment.method, locale),
    ],
    [ko ? '예약 총액' : '予約総額', formatYen(snapshot.totalAmountYen, locale)],
    [
      ko ? '취소 수수료율' : 'キャンセル料率',
      `${snapshot.cancellationFeePercent}%`,
    ],
    [
      ko ? '취소 수수료' : 'キャンセル料',
      formatYen(snapshot.cancellationFeeYen, locale),
    ],
    [
      ko ? '환불 예정 금액' : '返金予定額',
      formatYen(snapshot.refundTargetYen, locale),
    ],
  ]
  const customerMessage = automatic
    ? ko
      ? '입금 기한까지 입금을 확인할 수 없어 예약이 자동으로 취소되었습니다.'
      : 'お支払い期限までにご入金を確認できなかったため、ご予約は自動的にキャンセルされました。'
    : ko
      ? '예약이 취소되었습니다.'
      : 'ご予約をキャンセルしました。'
  const html = shell(
    hotelName,
    automatic
      ? ko
        ? '미입금으로 예약이 자동 취소되었습니다'
        : 'ご予約を自動キャンセルしました'
      : ko
        ? '예약이 취소되었습니다'
        : 'ご予約をキャンセルしました',
    `<p>${escapeHtml(snapshot.guest.name)} ${ko ? '고객님' : '様'}</p>${automatic ? `<p>${escapeHtml(customerMessage)}</p>` : ''}${table(rows)}${section(ko ? '취소 객실' : 'キャンセル対象客室', `<p style="white-space:pre-line">${escapeHtml(roomList)}</p>`)}${section(ko ? '환불 안내' : '返金のご案内', `<p style="white-space:pre-line">${escapeHtml(refundNotice)}</p>`)}<p style="color:#625f59;font-size:13px">${ko ? '문의처' : 'お問い合わせ'}: ${escapeHtml(contact(snapshot) || '—')}</p>`,
  )
  const text = `${hotelName}\n\n${customerMessage}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${ko ? '취소 객실' : 'キャンセル対象客室'}\n${roomList}\n\n${ko ? '환불 안내' : '返金のご案内'}\n${refundNotice}\n\n${ko ? '문의처' : 'お問い合わせ'}: ${contact(snapshot) || '—'}`
  return {
    to: snapshot.guest.email,
    fromEmail: senderEmail,
    fromName: senderName,
    replyTo: snapshot.hotel.email,
    subject,
    html,
    text,
  }
}

export function buildHotelCancellationNotification(
  snapshot: CancellationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  const automatic =
    snapshot.cancellationReason === 'bank_transfer_payment_expired'
  const subject = `${automatic ? '【入金期限切れ・自動キャンセル】' : '【予約キャンセル】'}${snapshot.guest.name}様｜${formatDate(snapshot.checkIn, 'ja')}〜${formatDate(snapshot.checkOut, 'ja')}｜予約番号 ${snapshot.reservationNumber}`
  const rooms = snapshot.rooms
    .map(
      (room, index) =>
        `客室 ${index + 1}: ${room.roomTypeNameJa} / 大人 ${room.adults}名 / 子ども ${room.paidChildren}名 / 添い寝 ${room.freePreschoolChildren}名 / ${mealLabel(room.mealPlan)}`,
    )
    .join('\n')
  const rows: Array<[string, string]> = [
    ['予約番号', snapshot.reservationNumber],
    ['予約者名', snapshot.guest.name],
    ['フリガナ', snapshot.guest.kana || '—'],
    ['電話番号', snapshot.guest.telephone],
    ['メールアドレス', snapshot.guest.email],
    ['チェックイン', formatDate(snapshot.checkIn, 'ja')],
    ['チェックアウト', formatDate(snapshot.checkOut, 'ja')],
    ['予約総額', formatYen(snapshot.totalAmountYen, 'ja')],
    ['キャンセル料', formatYen(snapshot.cancellationFeeYen, 'ja')],
    ['返金予定額', formatYen(snapshot.refundTargetYen, 'ja')],
    ['お支払い方法', paymentMethodLabel(snapshot.payment.method, 'ja')],
    ['お支払い状況', snapshot.payment.status],
    ['キャンセル日時', formatTokyoDateTime(snapshot.cancelledAt, 'ja')],
  ]
  if (automatic)
    rows.push(['キャンセル理由', '入金期限切れによる自動キャンセル'])
  const html = shell(
    snapshot.hotel.nameJa,
    automatic ? '入金期限切れによる自動キャンセル' : 'オンライン予約キャンセル',
    `${table(rows)}${section('客室情報', `<p style="white-space:pre-line">${escapeHtml(rooms)}</p>`)}${section('お客様からのご要望', `<p style="white-space:pre-line">${escapeHtml(snapshot.guestNote || 'なし')}</p>`)}`,
  )
  const text = `${automatic ? '入金期限切れによる自動キャンセル' : 'オンライン予約キャンセル'}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n客室情報\n${rooms}\n\nお客様からのご要望\n${snapshot.guestNote || 'なし'}`
  return {
    to: snapshot.hotel.email || '',
    fromEmail: senderEmail,
    fromName: senderName,
    replyTo: snapshot.guest.email,
    subject,
    html,
    text,
  }
}

function customerRefundNotice(
  snapshot: CancellationNotificationSnapshot,
  locale: NotificationLocale,
) {
  const ko = locale === 'ko'
  if (snapshot.refundTargetYen <= 0)
    return ko
      ? '결제된 금액이 없어 환불 절차는 발생하지 않습니다.'
      : 'お支払い済みの金額がないため、返金手続きはありません。'
  if (snapshot.payment.method === 'bank_transfer')
    return ko
      ? '환불은 취소 후 1주 이내에 처리합니다. 환불받을 계좌정보를 호텔 이메일로 보내주세요. 송금수수료는 고객 부담이며, 취소 수수료와 송금수수료를 차감한 금액을 환불합니다.'
      : '返金はキャンセル後1週間以内に対応します。返金先の口座情報をホテルのメールアドレスまでお送りください。振込手数料はお客様負担となり、キャンセル料と振込手数料を差し引いて返金します。'
  return ko
    ? '환불은 취소 후 1주 이내에 확인하여 처리합니다. 취소 수수료 및 필요한 송금수수료를 차감한 금액이 환불됩니다. 자세한 내용은 호텔로 문의해 주세요.'
    : '返金はキャンセル後1週間以内を目安に確認のうえ対応します。キャンセル料および必要な振込手数料を差し引いて返金します。詳しくはホテルへお問い合わせください。'
}

function shell(hotelName: string, title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f0e7;color:#292823;font-family:Arial,'Noto Sans JP','Noto Sans KR',sans-serif"><div style="max-width:640px;margin:0 auto;padding:24px 12px"><div style="background:#fff;padding:28px 24px;border-top:4px solid #9b4f37"><div style="font-size:13px;letter-spacing:.12em;color:#9b4f37">${escapeHtml(hotelName)}</div><h1 style="font-size:24px;line-height:1.4;margin:8px 0 24px">${escapeHtml(title)}</h1>${body}</div></div></body></html>`
}

function section(title: string, body: string) {
  return `<section style="margin:24px 0"><h2 style="font-size:17px;border-bottom:1px solid #ddd7cd;padding-bottom:8px">${escapeHtml(title)}</h2>${body}</section>`
}

function table(rows: Array<[string, string]>) {
  return `<table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;width:38%;padding:6px 8px 6px 0;color:#625f59;font-weight:normal">${escapeHtml(label)}</th><td style="padding:6px 0;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table>`
}

function formatDate(value: string, locale: NotificationLocale) {
  const [year, month, day] = value.split('-').map(Number)
  return locale === 'ko'
    ? `${year}년 ${month}월 ${day}일`
    : `${year}年${month}月${day}日`
}

function formatTokyoDateTime(value: string, locale: NotificationLocale) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatYen(value: number, locale: NotificationLocale) {
  return `${Math.round(value).toLocaleString(locale === 'ko' ? 'ko-KR' : 'ja-JP')}${locale === 'ko' ? '엔' : '円'}`
}

function paymentMethodLabel(value: string, locale: NotificationLocale) {
  const labels =
    locale === 'ko'
      ? { pay_at_hotel: '현장결제', bank_transfer: '계좌이체', card: '카드' }
      : { pay_at_hotel: '現地決済', bank_transfer: '銀行振込', card: 'カード' }
  return labels[value as keyof typeof labels] || value
}

function mealLabel(value: string) {
  return value === 'breakfast_dinner' ? '朝食＋夕食' : '朝食'
}

function contact(snapshot: CancellationNotificationSnapshot) {
  return [
    snapshot.hotel.telephone ? `TEL ${snapshot.hotel.telephone}` : null,
    snapshot.hotel.email ? `Email ${snapshot.hotel.email}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' / ')
}
