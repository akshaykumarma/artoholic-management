import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '@artoholic/shared';
import { AuthProvider } from '../src/auth/AuthContext';
import { ChecklistScreen } from '../src/checklist/ChecklistScreen';
import { mobileDraftStore } from '../src/drafts';
import { enqueuePhoto, processQueue, readQueue } from '../src/photos/queue';
import { installFetch, onRequest, resetFetch, calls, ME } from './fetch-mock';

const EV = '2b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const STEP = '3b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const ENTRY = '4b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const ITEM = '5b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const row = { entryId: ENTRY, sourceId: ENTRY, itemId: ITEM, itemCode: 'ITM-00001', itemName: 'White Chair', trackingType: 'counted', unitCode: null, sourceLabel: 'MAIN',
  usualBin: 'MAIN-A-01', expected: '50.000', done: false, dispatched: null, received: null, returned: null, handedOver: null, handoverEventId: null, handoverOptions: [],
  consumed: null, damaged: null, missing: null, remainingLength: null, shortReason: null, note: '', binLocationId: null, pieceId: null, pieceOptions: [], photoKeys: [], recheckReportId: null };
const step = { id: STEP, eventId: EV, eventNumber: 'EVT-2027-0001', eventName: 'Sangeet', round: 1, step: 'site_receipt', warehouseId: null, warehouseCode: null, status: 'in_progress',
  version: 1, ready: true, submittedAt: null, submittedBy: null, transport: { vehicleNumber: null, driverName: null, driverPhone: null }, bins: [], rows: [row] };

beforeEach(async () => {
  resetFetch();
  installFetch();
  await AsyncStorage.clear();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
  onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['event_manager'] } });
  onRequest(`/api/v1/events/${EV}/steps/${STEP}`, { status: 200, body: step });
});

describe('checklist drafts survive the app closing (006 SC-005, FR-014)', () => {
  it('restores typed entries after the screen is closed and reopened', async () => {
    const first = render(<AuthProvider><ChecklistScreen eventId={EV} stepId={STEP} /></AuthProvider>);
    fireEvent.changeText(await screen.findByLabelText('Received good'), '48');
    fireEvent.changeText(screen.getByLabelText('Damaged'), '2');
    first.unmount();
    render(<AuthProvider><ChecklistScreen eventId={EV} stepId={STEP} /></AuthProvider>);
    expect(await screen.findByText('Unsaved entries restored from this device')).toBeTruthy();
    expect(screen.getByLabelText('Received good').props.value).toBe('48');
    expect(screen.getByLabelText('Damaged').props.value).toBe('2');
  });

  it('asks to confirm a missing quantity, then submits the table', async () => {
    onRequest(`/api/v1/events/${EV}/steps/${STEP}/submit`, { status: 200, body: { ...step, status: 'submitted' } });
    render(<AuthProvider><ChecklistScreen eventId={EV} stepId={STEP} /></AuthProvider>);
    fireEvent.changeText(await screen.findByLabelText('Received good'), '49');
    expect(screen.getByText('White Chair: 1 missing')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'I confirm the missing quantities' }));
    fireEvent.press(screen.getByRole('button', { name: 'Submit checklist' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/submit'))).toBe(true));
    const body = JSON.parse(String(calls.find((c) => c.url.endsWith('/submit'))!.init!.body));
    expect(body).toMatchObject({ version: 1, confirmMissing: true, entries: [{ entryId: ENTRY, received: '49' }] });
  });
});

describe('damage photo queue (006 research R4)', () => {
  it('keeps a failed upload and retries it with backoff', async () => {
    await mobileDraftStore.remove('artoholic:photo-queue');
    const api = createApiClient({ baseUrl: 'http://test', platform: 'android', version: '0.1.0', getToken: async () => 'tok-123' });
    let puts = 0;
    onRequest('/api/v1/photos/upload-url', { status: 200, body: { url: 'http://storage/put', key: 'damage/2027-02/a.jpg' } });
    onRequest('file://', { status: 200, body: {} });
    onRequest('http://storage/put', () => (++puts === 1 ? { status: 500 } : { status: 200 }));
    await enqueuePhoto(mobileDraftStore, { uri: 'file://photo.jpg', width: 4000, height: 3000 }, { stepId: STEP, entryId: ENTRY, eventNumber: 'EVT-2027-0001' });
    expect(await processQueue(api, mobileDraftStore, 1000)).toHaveLength(0);
    const [queued] = await readQueue(mobileDraftStore);
    expect(queued).toMatchObject({ attempts: 1, uri: 'file://photo.jpg#compressed', eventNumber: 'EVT-2027-0001' });
    expect(await processQueue(api, mobileDraftStore, 1500)).toHaveLength(0); // still backing off
    const done = await processQueue(api, mobileDraftStore, 10_000);
    expect(done[0]!.key).toBe('damage/2027-02/a.jpg');
  });
});
