// Parcel insurance (certificate of insurance). Ported from the old Access function CalcCertIns:
//   cost to JP's = 1.22% of the declared value, minimum $27
//   customer pays = 3.5% of the declared value; when the 1.22% cost is $27 or less, the customer pays a flat $50
//   no declared value -> no insurance
export const INS_COST_RATE = 0.0122;
export const INS_CUSTOMER_RATE = 0.035;
export const INS_MIN_COST = 27;
export const INS_MIN_CUSTOMER = 50;

export function calcInsurance(declared: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (!(declared > 0)) return { jps: 0, customer: 0 };
  const calc = r(declared * INS_COST_RATE);
  return calc > INS_MIN_COST ? { jps: calc, customer: r(declared * INS_CUSTOMER_RATE) } : { jps: INS_MIN_COST, customer: INS_MIN_CUSTOMER };
}

// Credit-card fee: 3% of the amount paid + $0.30, added on top of what is owed. It applies to a card payment in the office (Square, card reader, manual)
// and to every payment made online (Stripe). The fee goes on the customer's receipt as a line, so the invoice shows it.
export const CARD_FEE_PCT = 0.03;
export const CARD_FEE_FIXED = 0.3;
export const cardFee = (amount: number) => (amount > 0 ? Math.round((amount * CARD_FEE_PCT + CARD_FEE_FIXED) * 100) / 100 : 0);
export const CARD_RATES = {
  invoice: { pct: CARD_FEE_PCT, fixed: CARD_FEE_FIXED, grossUp: false },
  present: { pct: CARD_FEE_PCT, fixed: CARD_FEE_FIXED, grossUp: false },
  manual: { pct: CARD_FEE_PCT, fixed: CARD_FEE_FIXED, grossUp: false },
} as const;

export function cardFees(amount: number) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const calc = ({ pct, fixed, grossUp }: { pct: number; fixed: number; grossUp: boolean }) => {
    if (!(amount > 0)) return { fee: 0, total: 0 };
    const total = grossUp ? r((amount + fixed) / (1 - pct)) : r(amount + amount * pct + fixed);
    return { fee: r(total - amount), total };
  };
  return { invoice: calc(CARD_RATES.invoice), present: calc(CARD_RATES.present), manual: calc(CARD_RATES.manual) };
}
