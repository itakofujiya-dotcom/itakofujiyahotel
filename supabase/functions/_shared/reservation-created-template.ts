import { escapeHtml } from './email-safety.ts'
import type {
  EmailMessage,
  NotificationLocale,
  ReservationNotificationSnapshot,
} from './notification-types.ts'

export function buildReservationCreatedEmail(
  snapshot: ReservationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  return snapshot.recipientKind === 'hotel'
    ? buildHotelNotification(snapshot, senderEmail, senderName)
    : buildCustomerConfirmation(snapshot, senderEmail, senderName)
}

export function buildCustomerConfirmation(
  snapshot: ReservationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  const locale = snapshot.locale === 'ko' ? 'ko' : 'ja'
  const ko = locale === 'ko'
  const hotelName =
    (ko ? snapshot.hotel.nameKo : snapshot.hotel.nameJa) ||
    snapshot.hotel.nameJa
  const subject = ko
    ? `[${hotelName}] 예약이 완료되었습니다 (예약번호: ${snapshot.reservationNumber})`
    : `【${hotelName}】ご予約を承りました（予約番号: ${snapshot.reservationNumber}）`
  const roomRows = snapshot.rooms
    .map((room, index) => renderRoomHtml(room, index, locale))
    .join('')
  const policyRows = snapshot.cancellationPolicies
    .map((policy) => {
      const description =
        (ko ? policy.descriptionKo : policy.descriptionJa) ||
        getPolicyRange(policy, locale)
      return `<li style="margin:4px 0">${escapeHtml(description)}: ${formatPercent(policy.feePercent)}%</li>`
    })
    .join('')
  const bankInstructions = getBankInstructions(snapshot, locale)
  const contact = formatHotelContact(snapshot, locale)

  const html = emailShell(
    hotelName,
    ko ? '예약이 완료되었습니다' : 'ご予約を承りました',
    `<p style="margin:0 0 20px">${escapeHtml(snapshot.guest.name)} ${ko ? '고객님' : '様'}<br>${ko ? '예약해 주셔서 감사합니다.' : 'このたびはご予約いただき、ありがとうございます。'}</p>
    ${section(
      ko ? '예약 정보' : 'ご予約内容',
      detailsTable([
        [ko ? '예약번호' : '予約番号', snapshot.reservationNumber],
        [ko ? '예약자명' : 'ご予約者名', snapshot.guest.name],
        [ko ? '후리가나' : 'フリガナ', snapshot.guest.kana || '—'],
        [
          ko ? '체크인' : 'チェックイン',
          formatHotelDate(snapshot.checkIn, locale),
        ],
        [
          ko ? '체크아웃' : 'チェックアウト',
          formatHotelDate(snapshot.checkOut, locale),
        ],
        [
          ko ? '도착 예정시간' : '到着予定時刻',
          formatHotelTime(snapshot.expectedCheckInTime),
        ],
        [
          ko ? '호텔 체크인/체크아웃' : 'ホテルのチェックイン／アウト',
          `${formatHotelTime(snapshot.hotel.checkInTime)} / ${formatHotelTime(snapshot.hotel.checkOutTime)}`,
        ],
        [
          ko ? '숙박 일수' : '泊数',
          `${snapshot.stayNights}${ko ? '박' : '泊'}`,
        ],
        [ko ? '객실 수' : '客室数', `${snapshot.roomCount}${ko ? '실' : '室'}`],
      ]),
    )}
    ${section(ko ? '객실 정보' : '客室情報', roomRows)}
    ${section(
      ko ? '결제 정보' : 'お支払い',
      detailsTable([
        [
          ko ? '예약 총액' : '予約総額',
          formatYen(snapshot.totalAmountYen, locale),
        ],
        [
          ko ? '결제 방법' : 'お支払い方法',
          paymentMethodLabel(snapshot.payment.method, locale),
        ],
        [
          ko ? '결제 상태' : 'お支払い状況',
          paymentStatusLabel(snapshot.payment.status, locale),
        ],
      ]) + bankInstructions,
    )}
    ${section(
      ko ? '요청사항' : 'ご要望',
      `<p style="white-space:pre-wrap;margin:0">${escapeHtml(snapshot.guestNote || (ko ? '없음' : 'なし'))}</p>`,
    )}
    ${section(ko ? '취소 안내' : 'キャンセルポリシー', `<ul style="margin:0;padding-left:20px">${policyRows}</ul><p style="margin:12px 0 0;white-space:pre-line">${escapeHtml(onlineCancellationNotice(locale))}</p>`)}
    <p style="margin:24px 0 0;color:#625f59;font-size:13px;line-height:1.7">${ko ? '문의처' : 'お問い合わせ'}: ${escapeHtml(contact || '—')}</p>`,
  )

  const textRooms = snapshot.rooms
    .map((room, index) => renderRoomText(room, index, locale))
    .join('\n\n')
  const textPolicies = snapshot.cancellationPolicies
    .map((policy) => {
      const description =
        (ko ? policy.descriptionKo : policy.descriptionJa) ||
        getPolicyRange(policy, locale)
      return `- ${description}: ${formatPercent(policy.feePercent)}%`
    })
    .join('\n')
  const text = `${hotelName}\n\n${ko ? '예약이 완료되었습니다.' : 'ご予約を承りました。'}\n\n${ko ? '예약번호' : '予約番号'}: ${snapshot.reservationNumber}\n${ko ? '예약자명' : 'ご予約者名'}: ${snapshot.guest.name}\n${ko ? '후리가나' : 'フリガナ'}: ${snapshot.guest.kana || '—'}\n${ko ? '체크인' : 'チェックイン'}: ${formatHotelDate(snapshot.checkIn, locale)}\n${ko ? '체크아웃' : 'チェックアウト'}: ${formatHotelDate(snapshot.checkOut, locale)}\n${ko ? '도착 예정시간' : '到着予定時刻'}: ${formatHotelTime(snapshot.expectedCheckInTime)}\n${ko ? '호텔 체크인/체크아웃' : 'ホテルのチェックイン／アウト'}: ${formatHotelTime(snapshot.hotel.checkInTime)} / ${formatHotelTime(snapshot.hotel.checkOutTime)}\n${ko ? '숙박 일수' : '泊数'}: ${snapshot.stayNights}${ko ? '박' : '泊'}\n${ko ? '객실 수' : '客室数'}: ${snapshot.roomCount}${ko ? '실' : '室'}\n\n${textRooms}\n\n${ko ? '예약 총액' : '予約総額'}: ${formatYen(snapshot.totalAmountYen, locale)}\n${ko ? '결제 방법' : 'お支払い方法'}: ${paymentMethodLabel(snapshot.payment.method, locale)}\n${ko ? '결제 상태' : 'お支払い状況'}: ${paymentStatusLabel(snapshot.payment.status, locale)}${bankInstructions ? `\n\n${stripHtml(bankInstructions)}` : ''}\n\n${ko ? '요청사항' : 'ご要望'}: ${snapshot.guestNote || (ko ? '없음' : 'なし')}\n\n${ko ? '취소 안내' : 'キャンセルポリシー'}\n${textPolicies}\n\n${onlineCancellationNotice(locale)}\n\n${ko ? '문의처' : 'お問い合わせ'}: ${contact || '—'}`

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

export function buildHotelNotification(
  snapshot: ReservationNotificationSnapshot,
  senderEmail: string,
  senderName: string,
): EmailMessage {
  const subject = `【新規予約】${snapshot.guest.name}様｜${formatHotelDate(snapshot.checkIn, 'ja')}〜${formatHotelDate(snapshot.checkOut, 'ja')}｜予約番号 ${snapshot.reservationNumber}`
  const roomRows = snapshot.rooms
    .map((room, index) => renderRoomHtml(room, index, 'ja'))
    .join('')
  const html = emailShell(
    snapshot.hotel.nameJa,
    '新規オンライン予約',
    `${section(
      '予約情報',
      detailsTable([
        ['予約番号', snapshot.reservationNumber],
        ['予約者名', snapshot.guest.name],
        ['フリガナ', snapshot.guest.kana || '—'],
        ['電話番号', snapshot.guest.telephone],
        ['メールアドレス', snapshot.guest.email],
        ['チェックイン', formatHotelDate(snapshot.checkIn, 'ja')],
        ['チェックアウト', formatHotelDate(snapshot.checkOut, 'ja')],
        ['到着予定時刻', formatHotelTime(snapshot.expectedCheckInTime)],
        ['泊数', `${snapshot.stayNights}泊`],
        ['客室数', `${snapshot.roomCount}室`],
        ['予約作成日時', formatCreatedAt(snapshot.createdAt)],
      ]),
    )}
    ${section('客室情報', roomRows)}
    ${section(
      'お支払い',
      detailsTable([
        ['予約総額', formatYen(snapshot.totalAmountYen, 'ja')],
        ['お支払い方法', paymentMethodLabel(snapshot.payment.method, 'ja')],
        ['お支払い状況', paymentStatusLabel(snapshot.payment.status, 'ja')],
      ]),
    )}
    ${section('お客様からのご要望', `<p style="white-space:pre-wrap;margin:0">${escapeHtml(snapshot.guestNote || 'なし')}</p>`)}`,
  )
  const textRooms = snapshot.rooms
    .map((room, index) => renderRoomText(room, index, 'ja'))
    .join('\n\n')
  const text = `新規オンライン予約\n\n予約番号: ${snapshot.reservationNumber}\n予約者名: ${snapshot.guest.name}\nフリガナ: ${snapshot.guest.kana || '—'}\n電話番号: ${snapshot.guest.telephone}\nメールアドレス: ${snapshot.guest.email}\nチェックイン: ${formatHotelDate(snapshot.checkIn, 'ja')}\nチェックアウト: ${formatHotelDate(snapshot.checkOut, 'ja')}\n到着予定時刻: ${formatHotelTime(snapshot.expectedCheckInTime)}\n泊数: ${snapshot.stayNights}泊\n客室数: ${snapshot.roomCount}室\n予約作成日時: ${formatCreatedAt(snapshot.createdAt)}\n\n${textRooms}\n\n予約総額: ${formatYen(snapshot.totalAmountYen, 'ja')}\nお支払い方法: ${paymentMethodLabel(snapshot.payment.method, 'ja')}\nお支払い状況: ${paymentStatusLabel(snapshot.payment.status, 'ja')}\n\nお客様からのご要望:\n${snapshot.guestNote || 'なし'}`
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

function renderRoomHtml(
  room: ReservationNotificationSnapshot['rooms'][number],
  index: number,
  locale: NotificationLocale,
): string {
  const ko = locale === 'ko'
  const roomName =
    (ko ? room.roomTypeNameKo : room.roomTypeNameJa) || room.roomTypeNameJa
  return `<div style="border:1px solid #ddd7cd;padding:16px;margin:0 0 12px">
    <strong>${ko ? '객실' : '客室'} ${index + 1}: ${escapeHtml(roomName)}</strong>
    ${detailsTable([
      [ko ? '성인' : '大人', `${room.adults}${ko ? '명' : '名'}`],
      [
        ko ? '어린이(유료)' : '子ども（有料）',
        `${room.paidChildren}${ko ? '명' : '名'}`,
      ],
      [
        ko ? '미취학 아동' : '未就学児',
        `${room.freePreschoolChildren}${ko ? '명' : '名'}`,
      ],
      [ko ? '식사 플랜' : '食事プラン', mealPlanLabel(room.mealPlan, locale)],
      [
        ko ? '객실 금액' : '客室料金',
        formatYen(room.baseRoomAmountYen, locale),
      ],
      [
        ko ? '식사 추가요금' : '食事追加料金',
        formatYen(room.mealSurchargeYen, locale),
      ],
      [ko ? '소계' : '小計', formatYen(room.subtotalYen, locale)],
    ])}
  </div>`
}

function renderRoomText(
  room: ReservationNotificationSnapshot['rooms'][number],
  index: number,
  locale: NotificationLocale,
): string {
  const ko = locale === 'ko'
  const roomName =
    (ko ? room.roomTypeNameKo : room.roomTypeNameJa) || room.roomTypeNameJa
  return `${ko ? '객실' : '客室'} ${index + 1}: ${roomName}\n${ko ? '성인' : '大人'}: ${room.adults}${ko ? '명' : '名'} / ${ko ? '어린이(유료)' : '子ども（有料）'}: ${room.paidChildren}${ko ? '명' : '名'} / ${ko ? '미취학 아동' : '未就学児'}: ${room.freePreschoolChildren}${ko ? '명' : '名'}\n${ko ? '식사 플랜' : '食事プラン'}: ${mealPlanLabel(room.mealPlan, locale)}\n${ko ? '객실 금액' : '客室料金'}: ${formatYen(room.baseRoomAmountYen, locale)} / ${ko ? '식사 추가요금' : '食事追加料金'}: ${formatYen(room.mealSurchargeYen, locale)} / ${ko ? '소계' : '小計'}: ${formatYen(room.subtotalYen, locale)}`
}

function getBankInstructions(
  snapshot: ReservationNotificationSnapshot,
  locale: NotificationLocale,
): string {
  if (snapshot.payment.method !== 'bank_transfer') return ''
  const ko = locale === 'ko'
  const instructions = ko
    ? snapshot.hotel.bankTransferInstructionsKo ||
      snapshot.hotel.bankTransferInstructionsJa
    : snapshot.hotel.bankTransferInstructionsJa
  const value =
    instructions ||
    (ko
      ? '계좌이체 정보는 호텔에서 별도로 안내해 드립니다.'
      : '振込先情報はホテルより別途ご案内いたします。')
  return `<div style="margin-top:14px;padding:14px;background:#f4f0e7;white-space:pre-wrap"><strong>${ko ? '계좌이체 안내' : '銀行振込のご案内'}</strong><br>${escapeHtml(value)}</div>`
}

function emailShell(hotelName: string, title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f0e7;color:#292823;font-family:Arial,'Noto Sans JP','Noto Sans KR',sans-serif"><div style="max-width:640px;margin:0 auto;padding:24px 12px"><div style="background:#fff;padding:28px 24px;border-top:4px solid #9b4f37"><div style="font-size:13px;letter-spacing:.12em;color:#9b4f37">${escapeHtml(hotelName)}</div><h1 style="font-size:24px;line-height:1.4;margin:8px 0 24px">${escapeHtml(title)}</h1>${body}</div></div></body></html>`
}

function section(title: string, content: string): string {
  return `<section style="margin:24px 0"><h2 style="font-size:17px;border-bottom:1px solid #ddd7cd;padding-bottom:8px">${escapeHtml(title)}</h2>${content}</section>`
}

function detailsTable(rows: Array<[string, string | number]>): string {
  return `<table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;width:38%;padding:6px 8px 6px 0;color:#625f59;font-weight:normal">${escapeHtml(label)}</th><td style="padding:6px 0;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join('')}</table>`
}

function formatHotelDate(value: string, locale: NotificationLocale): string {
  const [year, month, day] = value.split('-').map(Number)
  return locale === 'ko'
    ? `${year}년 ${month}월 ${day}일`
    : `${year}年${month}月${day}日`
}

function formatHotelTime(value: string | null): string {
  if (!value) return '—'
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? `${match[1]}:${match[2]}` : value
}

function formatHotelContact(
  snapshot: ReservationNotificationSnapshot,
  locale: NotificationLocale,
): string {
  const values = [
    snapshot.hotel.telephone ? `TEL ${snapshot.hotel.telephone}` : null,
    snapshot.hotel.fax ? `FAX ${snapshot.hotel.fax}` : null,
    snapshot.hotel.email ? `Email ${snapshot.hotel.email}` : null,
  ].filter((value): value is string => Boolean(value))
  return values.join(locale === 'ko' ? ' / ' : ' / ')
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatYen(value: number, locale: NotificationLocale): string {
  return `${Math.round(value).toLocaleString(locale === 'ko' ? 'ko-KR' : 'ja-JP')}${locale === 'ko' ? '엔' : '円'}`
}

function formatPercent(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)))
}

function mealPlanLabel(
  value: 'breakfast' | 'breakfast_dinner',
  locale: NotificationLocale,
): string {
  if (locale === 'ko')
    return value === 'breakfast_dinner' ? '조식 + 석식' : '조식'
  return value === 'breakfast_dinner' ? '朝食＋夕食' : '朝食'
}

function paymentMethodLabel(value: string, locale: NotificationLocale): string {
  const labels =
    locale === 'ko'
      ? { pay_at_hotel: '현장결제', bank_transfer: '계좌이체', card: '카드' }
      : { pay_at_hotel: '現地決済', bank_transfer: '銀行振込', card: 'カード' }
  return labels[value as keyof typeof labels] || value
}

function paymentStatusLabel(value: string, locale: NotificationLocale): string {
  const labels =
    locale === 'ko'
      ? {
          pending: '미결제',
          awaiting_payment: '입금 대기',
          paid: '결제 완료',
          refunded: '환불 완료',
          cancelled: '결제 취소',
        }
      : {
          pending: '未払い',
          awaiting_payment: '入金待ち',
          paid: '支払い済み',
          refunded: '返金済み',
          cancelled: '支払い取消',
        }
  return labels[value as keyof typeof labels] || value
}

function onlineCancellationNotice(locale: NotificationLocale): string {
  return locale === 'ko'
    ? '온라인 취소는 체크인 8일 전까지 가능합니다.\n그 이후의 취소는 호텔로 직접 문의해 주세요.'
    : 'オンラインでのキャンセルはチェックイン日の8日前まで可能です。\nそれ以降のキャンセルについては、ホテルまで直接お問い合わせください。'
}

function getPolicyRange(
  policy: ReservationNotificationSnapshot['cancellationPolicies'][number],
  locale: NotificationLocale,
): string {
  if (policy.isNoShow)
    return locale === 'ko' ? '노쇼(No-show)' : '無断不泊（No-show）'
  if (policy.minDaysBefore === policy.maxDaysBefore)
    return locale === 'ko'
      ? `${policy.minDaysBefore}일 전`
      : `${policy.minDaysBefore}日前`
  return locale === 'ko'
    ? `${policy.maxDaysBefore ?? ''}~${policy.minDaysBefore ?? ''}일 전`
    : `${policy.maxDaysBefore ?? ''}〜${policy.minDaysBefore ?? ''}日前`
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}
