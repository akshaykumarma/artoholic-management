import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ConventionsScreen from '../src/screens/ConventionsScreen';

describe('reference sample screen (US2, SC-002)', () => {
  const tz = process.env.TZ;
  afterAll(() => {
    process.env.TZ = tz;
  });

  it('prints IST values regardless of the device time zone', () => {
    process.env.TZ = 'America/Los_Angeles'; // UTC−8
    render(<ConventionsScreen />);
    expect(screen.getByTestId('sample-dt').props.children).toBe('20-11-2026 00:00 IST');
    expect(screen.getByTestId('sample-date').props.children).toBe('01-01-2027');
    expect(screen.getByTestId('sample-money').props.children).toBe('₹12,34,567.50');
    expect(screen.getByTestId('sample-neg').props.children).toBe('−₹1,200.00');
    expect(screen.getByTestId('sample-phone').props.children).toBe('+91 98765 43210');
    expect(screen.getByTestId('sample-evt').props.children).toBe('EVT-2026-0001');
  });
});
