import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Field, ui } from '../screens/ui';

type Bin = { id: string; code: string; quantity: string | null };

/**
 * Type part of a bin code; bins already holding the item come first (004 FR-009, US3).
 * Reports the chosen bin's id, or null while nothing is chosen.
 */
export function BinPicker({ label, warehouseId, itemId, onChange }: { label: string; warehouseId: string; itemId?: string; onChange: (id: string | null) => void }) {
  const { api } = useAuth();
  const [q, setQ] = useState('');
  const [bins, setBins] = useState<Bin[]>([]);
  const [chosen, setChosen] = useState<Bin | null>(null);
  useEffect(() => {
    const h = setTimeout(() => {
      const params = new URLSearchParams();
      if (itemId) params.set('itemId', itemId);
      if (q.trim()) params.set('q', q.trim());
      void api.get<{ items: Bin[] }>(`/api/v1/warehouses/${warehouseId}/bin-suggestions?${params.toString()}`).then((r) => setBins(r.items)).catch(() => undefined);
    }, 200);
    return () => clearTimeout(h);
  }, [api, warehouseId, itemId, q]);
  return (
    <View>
      <Field label={label} value={chosen ? chosen.code : q} autoCapitalize="characters"
        onChangeText={(v) => { setChosen(null); onChange(null); setQ(v); }} />
      {chosen ? null : bins.slice(0, 6).map((b) => (
        <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={b.code} style={ui.row} onPress={() => { setChosen(b); onChange(b.id); }}>
          <Text style={{ fontWeight: '600' }}>{b.code}</Text>
          {b.quantity ? <Text style={ui.muted}>{b.quantity.replace(/\.?0+$/, '')}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
