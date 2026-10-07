import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Screen, T, TopBar, attempt } from '@/components/ui';
import { PHONE_PATTERN } from '@/lib/call';
import { useStore } from '@/state/store';
import { space, useColors } from '@/theme';

/** Your phone number, so watchers can call you from an alert. */
export default function PhoneNumber() {
  const c = useColors();
  const store = useStore();
  const [phone, setPhone] = useState(store.me.phone ?? '');
  const trimmed = phone.trim();
  const valid = trimmed === '' || PHONE_PATTERN.test(trimmed);

  return (
    <Screen>
      <TopBar close title="Phone number" />
      <View style={{ marginTop: space.lg, gap: space.md }}>
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+234 803 123 4567"
          keyboardType="phone-pad"
          autoComplete="tel"
          autoFocus
        />
        {!valid && <T v="small" color={c.flare}>Use digits, spaces and an optional + at the start, like +234 803 123 4567.</T>}
        <T v="small" color={c.muted}>
          People you're connected with can see it and call you from an alert. Leave it empty to remove it.
        </T>
        <Button
          label="Save number"
          disabled={!valid}
          onPress={() => attempt(store.actions.savePhone(trimmed || null), () => router.back())}
        />
      </View>
    </Screen>
  );
}
