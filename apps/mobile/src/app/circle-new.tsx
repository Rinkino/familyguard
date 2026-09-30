import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Row, Screen, Section, T, Toggle, TopBar } from '@/components/ui';
import { useStore } from '@/state/store';
import { space } from '@/theme';

export default function NewCircle() {
  const store = useStore();
  const [name, setName] = useState('');
  const [share, setShare] = useState(false);

  const create = () => {
    const id = `c-${Date.now()}`;
    store.dispatch({ type: 'saveCircle', circle: { id, name: name.trim(), memberIds: [], shareWithCircle: share } });
    router.replace(`/circle/${id}`);
  };

  return (
    <Screen>
      <TopBar close title="New circle" />
      <View style={{ marginTop: space.lg, gap: space.lg }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Home, Church, Work" autoFocus />
      </View>
      <Section note="You'll pick people next.">
        <Row last>
          <T v="bodyStrong" style={{ flex: 1 }}>Share your location with this circle</T>
          <Toggle value={share} onChange={setShare} />
        </Row>
      </Section>
      <View style={{ marginTop: space.xl }}>
        <Button label="Create circle" disabled={!name.trim()} onPress={create} />
      </View>
    </Screen>
  );
}
