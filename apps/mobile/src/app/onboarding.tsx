import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { BondLine } from '@/components/BondLine';
import { Avatar, Button, Field, Icon, Screen, T } from '@/components/ui';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as Location from 'expo-location';
import { nameFromSession, useAuth } from '@/lib/auth';
import { flags } from '@/lib/flags';
import { useStore } from '@/state/store';
import { avatarTints, space, useColors } from '@/theme';

export default function Onboarding() {
  const c = useColors();
  const { actions } = useStore();
  const { session } = useAuth();
  const [step, setStep] = useState<'name' | 'lines' | 'permissions'>('name');
  const [name, setName] = useState(() => nameFromSession(session));
  const [tint, setTint] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (step === 'name') {
    return (
      <Screen>
        <View style={{ paddingTop: space.xxl, gap: space.lg }}>
          <T v="title">What should people call you?</T>
          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <Avatar name={name || 'You'} tint={tint} size={96} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }}>
            {avatarTints.map((hex, i) => (
              <Pressable
                key={hex}
                accessibilityRole="radio"
                accessibilityLabel={`Colour ${i + 1}`}
                accessibilityState={{ selected: tint === i }}
                onPress={() => setTint(i)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: hex,
                  borderWidth: 3,
                  borderColor: tint === i ? c.ink : 'transparent',
                }}
              />
            ))}
          </View>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Tobi Adewale" autoFocus />
          <T v="small" color={c.muted}>
            People you connect with see this name. They can give you their own label too.
          </T>
          <Button label="Continue" disabled={name.trim().length < 2} onPress={() => setStep('lines')} />
        </View>
      </Screen>
    );
  }

  if (step === 'permissions') {
    return (
      <Permissions
        saving={saving}
        error={error}
        onFinish={async () => {
          setSaving(true);
          setError('');
          try {
            flags.offerAddPerson = true;
            await actions.saveProfile(name.trim(), tint);
          } catch (e) {
            flags.offerAddPerson = false;
            setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
            setSaving(false);
          }
        }}
      />
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: space.xxl, gap: space.lg }}>
        <T v="title">One line tells you who can see who</T>
        <T v="body" color={c.muted}>
          Every person you add has a line between you. The left half is you, the right half is them.
        </T>

        <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: space.md, gap: space.lg }}>
          <Legend iShare theyShare text="Solid both ways. You can see each other." />
          <Legend iShare theyShare={false} text="You share with them. They don't share with you." />
          <Legend iShare={false} theyShare={false} text="Dashed. Nobody is sharing." />
        </View>

        <T v="small" color={c.muted}>
          You control your half. The only exception is a parent and child agreement, which you both have to accept.
        </T>
        <Button label="Continue" onPress={() => setStep('permissions')} />
      </View>
    </Screen>
  );
}

function Legend({ iShare, theyShare, text }: { iShare: boolean; theyShare: boolean; text: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ height: 12, flexDirection: 'row', alignItems: 'center' }}>
        <BondLine iShare={iShare} theyShare={theyShare} />
      </View>
      <T v="small">{text}</T>
    </View>
  );
}

type Status = 'unknown' | 'granted' | 'denied';

/** Explains each permission before the phone asks, so people know why. */
function Permissions({ saving, error, onFinish }: { saving: boolean; error: string; onFinish: () => void }) {
  const c = useColors();
  const [location, setLocation] = useState<Status>('unknown');
  const [mic, setMic] = useState<Status>('unknown');

  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocation(status === 'granted' ? 'granted' : 'denied');
  };
  const askMic = async () => {
    const res = await requestRecordingPermissionsAsync();
    setMic(res.granted ? 'granted' : 'denied');
  };

  return (
    <Screen>
      <View style={{ paddingTop: space.xxl, gap: space.lg }}>
        <T v="title">Two permissions</T>
        <T v="body" color={c.muted}>Your phone will ask for these. Here's what each is for.</T>
        <PermissionCard
          icon="map-pin"
          title="Location"
          body="So people you share with can see you, and so zones can tell when you leave them."
          status={location}
          onAllow={askLocation}
        />
        <PermissionCard
          icon="mic"
          title="Microphone"
          body="Only used during an SOS, to record what's happening for the people helping you."
          status={mic}
          onAllow={askMic}
        />
        <T v="small" color={c.muted}>You can change either one later in your phone's Settings.</T>
        <Button label={saving ? 'Saving…' : 'Finish'} disabled={saving} onPress={onFinish} />
        {error ? <T v="small" color={c.flare}>{error}</T> : null}
      </View>
    </Screen>
  );
}

function PermissionCard({
  icon,
  title,
  body,
  status,
  onAllow,
}: {
  icon: 'map-pin' | 'mic';
  title: string;
  body: string;
  status: Status;
  onAllow: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name={icon} color={c.beacon} />
        <T v="bodyStrong" style={{ flex: 1 }}>{title}</T>
        {status === 'granted' && <Icon name="check-circle" color={c.beacon} />}
      </View>
      <T v="small" color={c.muted}>{body}</T>
      {status === 'unknown' && <Button kind="secondary" label={`Allow ${title.toLowerCase()}`} onPress={onAllow} />}
      {status === 'denied' && (
        <T v="small" color={c.flare}>Turned off. You can allow it later in your phone's Settings.</T>
      )}
    </View>
  );
}
