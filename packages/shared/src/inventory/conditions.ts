/** Stock conditions (research R3). On hand = available + reserved + out + damaged (+ in transit). */
export const CONDITIONS = ['available', 'reserved', 'damaged', 'out', 'in_transit', 'lost', 'written_off', 'consumed'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const IN_BIN: readonly Condition[] = ['available', 'reserved', 'damaged'];
export const ON_HAND: readonly Condition[] = ['available', 'reserved', 'damaged', 'out', 'in_transit'];
export const TERMINAL: readonly Condition[] = ['lost', 'written_off', 'consumed'];

export const MOVEMENT_TYPES = [
  'opening', 'receipt', 'reserve', 'release', 'dispatch', 'return', 'move', 'damage', 'repair_ok', 'lost',
  'write_off', 'consume', 'cut', 'transfer_out', 'transfer_in', 'handover', 'adjustment', 'correction'
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const TRACKING_TYPES = ['counted', 'measured', 'cut'] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];
