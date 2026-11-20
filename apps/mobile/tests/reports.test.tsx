import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AuthProvider } from '../src/auth/AuthContext';
import { ReportScreen } from '../src/screens/ReportScreens';
import { installFetch, onRequest, resetFetch, ME } from './fetch-mock';

const RUN = '9b0c2a4e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

beforeEach(async () => {
  resetFetch();
  installFetch();
  await SecureStore.setItemAsync('artoholic.session', 'tok-123');
  onRequest('/api/v1/me', { status: 200, body: { ...ME, roles: ['admin'] } });
  onRequest('/api/v1/reports/R5/run', { status: 200, body: { columns: [{ key: 'type', label: 'Type', type: 'text' }, { key: 'quantity', label: 'Quantity', type: 'quantity' }], rows: [{ type: 'Damage report', quantity: '2.000' }], total: 1, page: 1, pageSize: 200 } });
  onRequest('/api/v1/reports/R5/export', { status: 202, body: { runId: RUN, rowCount: 1 } });
});

describe('mobile reports (009 FR-008)', () => {
  it('shows the report and shares the Excel file', async () => {
    render(<AuthProvider><ReportScreen id="R5" /></AuthProvider>);
    expect(await screen.findByText('Damage report')).toBeTruthy();
    expect(screen.getByText(/Quantity: 2/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Share Excel' }));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
    expect((FileSystem.downloadAsync as jest.Mock).mock.calls[0][0]).toContain(`/api/v1/reports/runs/${RUN}/download`);
    expect((FileSystem.downloadAsync as jest.Mock).mock.calls[0][2].headers.authorization).toBe('Bearer tok-123');
  });
});
