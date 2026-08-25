export type NotificationLocale = 'ja' | 'ko'
export type NotificationRecipientKind = 'customer' | 'hotel'

export type ReservationNotificationSnapshot = {
  deliveryId: string
  recipientKind: NotificationRecipientKind
  notificationType: 'reservation_created'
  reservationId: string
  reservationNumber: string
  locale: NotificationLocale
  checkIn: string
  checkOut: string
  stayNights: number
  roomCount: number
  totalAmountYen: number
  guestNote: string | null
  createdAt: string
  guest: {
    name: string
    kana: string | null
    email: string
    telephone: string
  }
  payment: {
    method: 'pay_at_hotel' | 'bank_transfer' | 'card'
    status: 'pending' | 'awaiting_payment' | 'paid' | 'refunded' | 'cancelled'
    amountYen: number
  }
  rooms: Array<{
    roomTypeCode: string
    roomTypeNameJa: string
    roomTypeNameKo: string | null
    adults: number
    paidChildren: number
    freePreschoolChildren: number
    mealPlan: 'breakfast' | 'breakfast_dinner'
    baseRoomAmountYen: number
    mealSurchargeYen: number
    subtotalYen: number
  }>
  cancellationPolicies: Array<{
    code: string
    minDaysBefore: number | null
    maxDaysBefore: number | null
    feePercent: number
    isNoShow: boolean
    descriptionJa: string | null
    descriptionKo: string | null
  }>
  hotel: {
    nameJa: string
    nameKo: string | null
    nameEn: string | null
    email: string | null
    telephone: string | null
    bankTransferInstructionsJa: string | null
    bankTransferInstructionsKo: string | null
  }
}

export type EmailMessage = {
  to: string
  fromEmail: string
  fromName: string
  replyTo?: string | null
  subject: string
  html: string
  text: string
}

export type MailSendResult = {
  provider: string
  messageId: string
}

export interface MailProvider {
  send(message: EmailMessage): Promise<MailSendResult>
}
