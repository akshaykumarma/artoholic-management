import { describe, it, expect } from 'vitest';
import { reconcile } from '../src/events/reconcile';

describe('reconcile (006 research R2)', () => {
  it('balances returned + handed over + consumed + damaged + lost against dispatched', () => {
    expect(reconcile({ dispatched: '50', returned: '45', handedOver: '0', consumed: '0', damagedApproved: '4', lostApproved: '1' }))
      .toEqual({ accounted: '50.000', outstanding: '0.000', reconciled: true });
  });
  it('reports what is still outstanding', () => {
    expect(reconcile({ dispatched: '12', returned: '9', handedOver: '0', consumed: '2.5', damagedApproved: '0', lostApproved: '0' }))
      .toMatchObject({ outstanding: '0.500', reconciled: false });
  });
});
