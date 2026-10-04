import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '@/theme';

/**
 * FamilyGuard mark: a sheltering arc over a parent holding a child's hand.
 * Same geometry as assets/brand/make.sh (1024 grid).
 */
export function Logo({ size = 48, tile = true }: { size?: number; tile?: boolean }) {
  const c = useColors();
  const parent = tile ? '#FFFFFF' : c.beacon;
  const child = tile ? '#BFE3CF' : c.moss;
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="FamilyGuard">
      {tile && <Rect width={1024} height={1024} rx={230} fill={c.beacon} />}
      <Path d="M277 685.5 A250 250 0 1 1 747 685.5" fill="none" stroke={parent} strokeWidth={80} strokeLinecap="round" />
      <Path
        d="M440 532 V624 M440 624 L410 706 M440 624 L470 706 M440 560 L408 632 M440 560 L516 634"
        fill="none"
        stroke={parent}
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={440} cy={470} r={46} fill={parent} />
      <Path
        d="M592 606 V662 M592 662 L572 708 M592 662 L612 708 M592 624 L524 636 M592 624 L618 668"
        fill="none"
        stroke={child}
        strokeWidth={36}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={592} cy={560} r={34} fill={child} />
    </Svg>
  );
}
