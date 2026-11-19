import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../src/auth/AuthContext';
import { CountSheetScreen } from '../src/screens/CountScreens';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

const S = '6b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const L1 = '7b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const ITEM = '5b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const BIN = '8b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const sheet = { id: S, number: 'CNT-2026-0001', dueDate: '2026-12-01', blind: true, status: 'open', canCount: true, locations: [{ id: BIN, code: 'MAIN-A-01' }],
  lines: [{ id: L1, itemId: ITEM, itemCode: 'ITM-00001', itemName: 'White Chair', unitCode: null, pieceId: null, pieceNumber: null, locationId: BIN, locationCode: 'MAIN-A-01',
    condition: 'available', countedQty: null, note: '', photoKey: null, countedBy: null, addedByCounter: false, eventMovement: true, decision: null }] };

beforeEach(async () => {
  resetFetch();
  installFetch();
  await AsyncStorage.clear();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
  onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['store_manager'] } });
  onRequest(`/api/v1/counts/sessions/${S}/sheet`, { status: 200, body: sheet });
});

describe('mobile count sheet (007 US3, FR-009)', () => {
  it('shows no recorded quantity in a blind count, flags event movement, and keeps counts across restarts', async () => {
    const first = render(<AuthProvider><CountSheetScreen id={S} /></AuthProvider>);
    const input = await screen.findByLabelText('Counted · MAIN-A-01 · White Chair');
    expect(screen.queryByText(/Recorded/)).toBeNull();
    expect(screen.getByText('Available · Event movement in progress')).toBeTruthy();
    fireEvent.changeText(input, '37');
    first.unmount();
    render(<AuthProvider><CountSheetScreen id={S} /></AuthProvider>);
    expect(await screen.findByText('Unsaved counts restored from this device')).toBeTruthy();
    expect(screen.getByLabelText('Counted · MAIN-A-01 · White Chair').props.value).toBe('37');
  });

  it('saves then submits with the zero confirmation', async () => {
    onRequest(`/api/v1/counts/sessions/${S}/entries`, { status: 200, body: { saved: 1, added: 0 } });
    onRequest(`/api/v1/counts/sessions/${S}/submit`, { status: 200, body: { status: 'submitted' } });
    render(<AuthProvider><CountSheetScreen id={S} /></AuthProvider>);
    fireEvent.changeText(await screen.findByLabelText('Counted · MAIN-A-01 · White Chair'), '40');
    fireEvent.press(screen.getByRole('button', { name: 'Uncounted lines mean none found' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit count' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/submit'))).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/entries'))!.init!.body))).toEqual({ entries: [{ lineId: L1, countedQty: '40' }] });
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/submit'))!.init!.body))).toEqual({ confirmZero: true });
  });
});
