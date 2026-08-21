import { paymentStatusLabels } from './payment-helpers'
import type { PaymentStatus } from './types'

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className="inline-flex rounded bg-stone-100 px-2.5 py-1 text-xs font-semibold text-ink">
      {paymentStatusLabels[status]}
    </span>
  )
}
