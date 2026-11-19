/**
 * Report catalogue R1–R10 (009 research R1): screens and Excel share these columns, so they can't disagree.
 */
export const REPORT_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'] as const;
export type ReportId = (typeof REPORT_IDS)[number];
export type ColumnType = 'text' | 'date' | 'datetime' | 'money' | 'quantity' | 'number';
export type FilterKey = 'from' | 'to' | 'warehouseId' | 'categoryId' | 'eventId' | 'userId' | 'sessionId';

export interface ReportDef {
  id: ReportId;
  title: string;
  filters: FilterKey[];
  columns: Array<{ key: string; label: string; type: ColumnType }>;
}

const c = (key: string, label: string, type: ColumnType = 'text') => ({ key, label, type });

export const REPORTS: Record<ReportId, ReportDef> = {
  R1: { id: 'R1', title: 'Stock on hand', filters: ['warehouseId', 'categoryId'], columns: [
    c('item', 'Item'), c('code', 'Code'), c('category', 'Category'), c('warehouse', 'Warehouse'), c('bin', 'Bin'),
    c('available', 'Available', 'quantity'), c('reserved', 'Reserved', 'quantity'), c('out', 'Out', 'quantity'), c('damaged', 'Damaged', 'quantity'), c('value', 'Value', 'money')] },
  R2: { id: 'R2', title: 'Stock movement ledger', filters: ['from', 'to', 'warehouseId'], columns: [
    c('at', 'Date', 'datetime'), c('item', 'Item'), c('type', 'Type'), c('quantity', 'Quantity', 'quantity'), c('from', 'From'), c('to', 'To'),
    c('user', 'User'), c('reference', 'Reference'), c('reason', 'Reason')] },
  R3: { id: 'R3', title: 'Event item status', filters: ['from', 'to', 'eventId'], columns: [
    c('event', 'Event'), c('item', 'Item'), c('source', 'Source'), c('planned', 'Planned', 'quantity'), c('dispatched', 'Dispatched', 'quantity'),
    c('received', 'Received', 'quantity'), c('returned', 'Returned', 'quantity'), c('handedOver', 'Handed over', 'quantity'), c('damaged', 'Damaged', 'quantity'),
    c('lost', 'Lost', 'quantity'), c('consumed', 'Consumed', 'quantity'), c('gap', 'Gap', 'quantity')] },
  R4: { id: 'R4', title: 'Damage and loss', filters: ['from', 'to', 'eventId'], columns: [
    c('at', 'Date', 'datetime'), c('number', 'Number'), c('event', 'Event'), c('item', 'Item'), c('quantity', 'Quantity', 'quantity'), c('kind', 'Kind'),
    c('reason', 'Reason'), c('value', 'Value', 'money'), c('reporter', 'Reporter'), c('decision', 'Decision'), c('decidedBy', 'Decided by')] },
  R5: { id: 'R5', title: 'Pending approvals', filters: [], columns: [
    c('type', 'Type'), c('number', 'Number'), c('context', 'Event or count'), c('item', 'Item'), c('quantity', 'Quantity', 'quantity'), c('since', 'Waiting since', 'datetime')] },
  R6: { id: 'R6', title: 'Upcoming dispatches and returns (7 days)', filters: ['warehouseId'], columns: [
    c('date', 'Date', 'date'), c('kind', 'Kind'), c('event', 'Event'), c('warehouses', 'Warehouses'), c('lines', 'Lines', 'number'), c('managers', 'Managers'),
    c('status', 'Status'), c('overbooked', 'Over-booked')] },
  R7: { id: 'R7', title: 'Physical count variance', filters: ['from', 'to', 'sessionId', 'warehouseId'], columns: [
    c('session', 'Session'), c('item', 'Item'), c('bin', 'Bin'), c('recorded', 'Recorded', 'quantity'), c('counted', 'Counted', 'quantity'),
    c('variance', 'Variance', 'quantity'), c('value', 'Value', 'money'), c('decision', 'Decision')] },
  R8: { id: 'R8', title: 'Item utilisation', filters: ['from', 'to', 'categoryId'], columns: [
    c('item', 'Item'), c('code', 'Code'), c('events', 'Events used', 'number'), c('daysOut', 'Days out', 'number'), c('idleDays', 'Idle days', 'number'), c('lastUsed', 'Last used', 'date')] },
  R9: { id: 'R9', title: 'Low and dead stock', filters: ['warehouseId', 'categoryId'], columns: [
    c('item', 'Item'), c('code', 'Code'), c('available', 'Available', 'quantity'), c('minimum', 'Minimum', 'quantity'), c('lastUsed', 'Last used', 'date'), c('status', 'Status')] },
  R10: { id: 'R10', title: 'User activity', filters: ['from', 'to', 'userId'], columns: [
    c('user', 'User'), c('actions', 'Actions', 'number'), c('byType', 'Actions by type'), c('events', 'Events', 'number'), c('approvals', 'Approvals', 'number'), c('lastSignIn', 'Last sign-in', 'datetime')] }
};
