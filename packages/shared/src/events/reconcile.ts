import Decimal from 'decimal.js';

/** Per line and source (006 research R2): returned + handed over + damaged + lost + consumed = dispatched. */
export interface LineTotals {
  dispatched: string;
  returned: string;
  handedOver: string;
  consumed: string;
  damagedApproved: string;
  lostApproved: string;
}

export function reconcile(t: LineTotals): { accounted: string; outstanding: string; reconciled: boolean } {
  const accounted = [t.returned, t.handedOver, t.consumed, t.damagedApproved, t.lostApproved].reduce((s, v) => s.plus(v || 0), new Decimal(0));
  const outstanding = new Decimal(t.dispatched || 0).minus(accounted);
  return { accounted: accounted.toFixed(3), outstanding: outstanding.toFixed(3), reconciled: outstanding.eq(0) };
}
