import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { avatarTints, fonts, space, type, useColors } from '@/theme';

type TextVariant = keyof typeof type;

export function T({
  v = 'body',
  color,
  style,
  children,
  numberOfLines,
}: {
  v?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const c = useColors();
  return (
    <Text numberOfLines={numberOfLines} style={[type[v], { color: color ?? c.ink }, style]}>
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const inner: ViewStyle = {
    paddingHorizontal: padded ? space.md : 0,
    paddingBottom: insets.bottom + space.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  };
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }, inner]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[{ paddingTop: insets.top }, inner]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Top bar for pushed screens and modals. */
export function TopBar({
  title,
  close,
  right,
}: {
  title?: string;
  close?: boolean;
  right?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 52, gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={close ? 'Close' : 'Back'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}
      >
        <Feather name={close ? 'x' : 'chevron-left'} size={20} color={c.ink} />
      </Pressable>
      <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
        {title ?? ''}
      </T>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ink' | 'danger' | 'plain';
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const palette = {
    primary: { bg: c.beacon, fg: c.onBeacon, border: c.beacon },
    secondary: { bg: c.surface, fg: c.ink, border: c.hairline },
    ink: { bg: c.ink, fg: c.bg, border: c.ink },
    danger: { bg: 'transparent', fg: c.flare, border: 'transparent' },
    plain: { bg: 'transparent', fg: c.beaconText, border: 'transparent' },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 52,
          borderRadius: 26,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: palette.border,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={[type.bodyStrong, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, tint, size = 44 }: { name: string; tint: number; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarTints[tint % avatarTints.length],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.38, color: '#FFFFFF' }}>{initials || '?'}</Text>
    </View>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ false: c.hairline, true: c.beacon }}
      thumbColor="#FFFFFF"
      {...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {})}
    />
  );
}

/** A grouped list section with a plain-language heading. */
export function Section({ title, children, note }: { title?: string; children: ReactNode; note?: string }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.lg }}>
      {title ? (
        <T v="smallStrong" color={c.muted} style={{ marginBottom: space.sm, marginLeft: space.xs }}>
          {title}
        </T>
      ) : null}
      <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }}>{children}</View>
      {note ? (
        <T v="small" color={c.muted} style={{ marginTop: space.sm, marginHorizontal: space.xs }}>
          {note}
        </T>
      ) : null}
    </View>
  );
}

export function Row({
  children,
  onPress,
  last,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const style: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: last ? 0 : 1,
    borderBottomColor: c.hairline,
  };
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { backgroundColor: c.beaconSoft }]}
    >
      {children}
    </Pressable>
  );
}

export function Icon(props: ComponentProps<typeof Feather>) {
  const c = useColors();
  return <Feather size={20} color={c.muted} {...props} />;
}

export function Field(props: TextInputProps & { label: string }) {
  const c = useColors();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.sm }}>
      <T v="smallStrong" color={c.muted}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={c.moss}
        style={[
          type.body,
          {
            color: c.ink,
            backgroundColor: c.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.hairline,
            paddingHorizontal: space.md,
            height: 52,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

/** Cross-platform info dialog. */
export function notice(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** Runs a save in the background and tells the user if it failed. */
export function attempt(p: Promise<unknown>, onDone?: () => void) {
  p.then(() => onDone?.()).catch((e) => notice("That didn't save", e instanceof Error ? e.message : 'Check your connection and try again.'));
}

/** Cross-platform confirm dialog (RN Alert is a no-op on web). */
export function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
