import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import { AuthProvider } from '../src/auth/AuthContext';
import { ItemViewScreen } from '../src/screens/InventoryScreens';
import { compress } from '../src/photos/upload';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

const ITEM = '5b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const LOC = '7c1d2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const view = {
  item: { id: ITEM, code: 'ITM-00001', name: 'White Chair', categoryId: ITEM, categoryName: 'Furniture', description: '', trackingType: 'counted', unitCode: null, replacementValuePaise: 150000, minimumStock: null, minimumUsableLength: null, notes: '', status: 'active', updatedAt: '2026-11-19T10:00:00.000Z' },
  codes: [{ code: 'ITM-00001', activeFrom: '2026-11-19T10:00:00.000Z', activeTo: null }], photos: [],
  totals: { available: '40.000', reserved: '0.000', damaged: '0.000', out: '0.000', in_transit: '0.000', lost: '0.000', written_off: '0.000', consumed: '0.000' },
  onHand: '40.000',
  balances: [{ warehouseCode: 'MAIN', locationCode: 'MAIN-DEFAULT', locationId: LOC, eventId: null, pieceNumber: null, pieceId: null, condition: 'available', quantity: '40.000' }],
  pieces: [], lastUsedIn: null, reservations: [], damage: { damagedToDate: '0.000', currentlyDamaged: '0.000', writtenOff: '0.000', lost: '0.000' }, history: []
};

beforeEach(async () => {
  resetFetch();
  installFetch();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
});

describe('mobile item view (003)', () => {
  it('shows stock and sends a Store Manager correction request', async () => {
    onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['store_manager'] } });
    onRequest(`/api/v1/catalogue/items/${ITEM}`, { status: 200, body: view });
    onRequest('/api/v1/stock/corrections', { status: 202, body: { id: ITEM, status: 'pending', kind: 'correction' } });
    render(<AuthProvider><ItemViewScreen id={ITEM} /></AuthProvider>);
    expect(await screen.findByText('Available: 40')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Change'), '-3');
    fireEvent.changeText(screen.getByLabelText('Reason'), 'broken');
    fireEvent.press(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Sent to an Admin for approval')).toBeTruthy();
    const post = calls.find((c) => c.url.endsWith('/api/v1/stock/corrections'))!;
    expect(JSON.parse(String(post.init!.body))).toEqual({ itemId: ITEM, locationId: LOC, condition: 'available', quantityChange: '-3', reason: 'broken' });
  });
});

describe('photo compression (constitution IV)', () => {
  it('resizes so the longest side is 1600 px', async () => {
    await compress('file://a.jpg', 4000, 3000);
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith('file://a.jpg', [{ resize: { width: 1600 } }], { compress: 0.8, format: 'jpeg' });
    await compress('file://b.jpg', 1000, 3000);
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith('file://b.jpg', [{ resize: { height: 1600 } }], expect.anything());
  });
  it('leaves small photos at their size', async () => {
    await compress('file://c.jpg', 1200, 800);
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith('file://c.jpg', [], expect.anything());
  });
});
