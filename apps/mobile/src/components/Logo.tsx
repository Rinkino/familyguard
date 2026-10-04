import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '@/theme';

/**
 * FamilyGuard mark: a sheltering arc over a parent and a child.
 * Same geometry as assets/brand/*.svg (1024 grid).
 */
export function Logo({ size = 48, tile = true }: { size?: number; tile?: boolean }) {
  const c = useColors();
  const fg = tile ? '#FFFFFF' : c.beacon;
  const child = tile ? '#BFE3CF' : c.moss;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="FamilyGuard">
      {tile && <Rect width={1024} height={1024} rx={230} fill={c.beacon} />}
      <Path d="M277 685.5 A250 250 0 1 1 747 685.5" fill="none" stroke={fg} strokeWidth={80} strokeLinecap="round" />
      <Circle cx={448} cy={638} r={84} fill={fg} />
      <Circle cx={606} cy={666} r={56} fill={child} />
    </Svg>
  );
}
