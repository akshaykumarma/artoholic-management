import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../src/auth/AuthContext';
import { MoveScreen } from '../src/screens/WarehouseScreens';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

const WH = '1b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const ITEM = '5b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const A1 = '7c1d2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const B2 = '8c1d2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

beforeEach(async () => {
  resetFetch();
  installFetch();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
});

describe('mobile move with the bin picker (004 US3)', () => {
  it('picks an item, the bin holding it, a target bin, and posts one move', async () => {
    onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['store_manager'] } });
    onRequest('/api/v1/catalogue/items', { status: 200, body: { items: [{ id: ITEM, code: 'ITM-00001', name: 'White Chair', categoryId: ITEM, categoryName: 'Furniture', description: '', trackingType: 'counted', unitCode: null, replacementValuePaise: 0, minimumStock: null, minimumUsableLength: null, notes: '', status: 'active', updatedAt: '2026-11-19T10:00:00.000Z', available: '25.000', onHand: '25.000' }], nextCursor: null } });
    onRequest('/bin-suggestions', { status: 200, body: { items: [{ id: A1, code: 'MAIN-A-01', quantity: '25.000' }, { id: B2, code: 'MAIN-B-02', quantity: null }] } });
    onRequest('/api/v1/stock/moves', { status: 201, body: { movementId: 1 } });
    render(<AuthProvider><MoveScreen warehouseId={WH} /></AuthProvider>);
    fireEvent.press(await screen.findByText('ITM-00001 · White Chair'));
    const a1 = await screen.findAllByRole('button', { name: 'MAIN-A-01' });
    fireEvent.press(a1[0]!);
    const b2 = await screen.findAllByRole('button', { name: 'MAIN-B-02' });
    fireEvent.press(b2[b2.length - 1]!);
    fireEvent.changeText(screen.getByLabelText('Quantity'), '10');
    fireEvent.press(screen.getByRole('button', { name: 'Move stock' }));
    expect(await screen.findByText('Moved')).toBeTruthy();
    const post = calls.find((c) => c.url.endsWith('/api/v1/stock/moves'))!;
    expect(JSON.parse(String(post.init!.body))).toEqual({ itemId: ITEM, fromLocationId: A1, toLocationId: B2, quantity: '10', condition: 'available' });
  });
});
