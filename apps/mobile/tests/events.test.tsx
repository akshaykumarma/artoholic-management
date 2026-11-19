import React from 'react';
import { render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../src/auth/AuthContext';
import { EventScreen, TodayScreen } from '../src/screens/EventScreens';
import { installFetch, onRequest, resetFetch, ME } from './fetch-mock';

const EV = '2b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const ITEM = '5b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const WH = '1b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const row = { id: EV, number: 'EVT-2027-0002', name: 'Reception', typeName: null, status: 'scheduled', venueName: 'Palace Grounds', startsAt: '2027-01-11T12:30:00.000Z', endsAt: '2027-01-12T16:30:00.000Z', leaveWarehouseAt: '2027-01-11T03:30:00.000Z', expectedReturnDate: '2027-01-13', overbooked: true };
const detail = {
  ...row, typeId: null, description: '', venueAddress: 'Bengaluru', latitude: null, longitude: null, siteContactName: '', siteContactPhone: null, notes: '',
  cancelledReason: null, version: 2, eventManagers: [{ id: ME.id, fullName: 'Owner' }], storeManagers: [], suggestedStoreManagers: [],
  lines: [{ id: ITEM, itemId: ITEM, itemCode: 'ITM-00001', itemName: 'White Chair', unitCode: null, plannedQty: '30.000', notes: '',
    sources: [{ type: 'warehouse', warehouseId: WH, warehouseCode: 'MAIN', eventId: null, eventNumber: null, qty: '30.000', reservedQty: '20.000' }] }],
  warnings: [{ id: ITEM, itemId: ITEM, itemName: 'White Chair', warehouseId: WH, warehouseCode: 'MAIN', sourceEventId: null, shortfallQty: '10.000', clashingEvents: [], raisedAt: '2027-01-01T00:00:00.000Z' }],
  clashWarnings: [], linesWithoutStoreManager: []
};

beforeEach(async () => {
  resetFetch();
  installFetch();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
  onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['store_manager'] } });
});

describe('mobile events (005)', () => {
  it('shows the over-booking banner on an event', async () => {
    onRequest(`/api/v1/events/${EV}`, { status: 200, body: detail });
    render(<AuthProvider><EventScreen id={EV} /></AuthProvider>);
    expect(await screen.findByText('Over-booked: 1 line(s) are short. Everyone on this event has been told.')).toBeTruthy();
    expect(screen.getByText('White Chair from MAIN: 10 short')).toBeTruthy();
  });

  it('lists today’s dispatches and returns', async () => {
    onRequest('/api/v1/events/today', { status: 200, body: { date: '2027-01-11', dispatches: [row], returns: [] } });
    render(<AuthProvider><TodayScreen onOpen={() => undefined} /></AuthProvider>);
    expect(await screen.findByText('⚠ Reception')).toBeTruthy();
    expect(screen.getByText('Nothing today')).toBeTruthy();
  });
});
