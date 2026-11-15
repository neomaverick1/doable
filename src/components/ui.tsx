import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { colors, radius, space, tagColor, type } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, bottomInset = 120, scroll = true }: { children: ReactNode; bottomInset?: number; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const content: ViewStyle = {
    paddingTop: insets.top + space.lg,
    paddingHorizontal: space.lg,
    paddingBottom: bottomInset,
    gap: space.lg,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.bg }, content]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const fg =
    variant === 'primary' || variant === 'ai'
      ? colors.white
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.ink
          : colors.accent;
  const inner = (
    <View style={styles.buttonInner}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: colors.accent },
        variant === 'secondary' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        variant === 'ai' && { overflow: 'hidden' },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {variant === 'ai' ? (
        <LinearGradient colors={[colors.ai, colors.aiPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : null}
      {inner}
    </Pressable>
  );
}

export function Chip({
  icon,
  label,
  color = colors.muted,
  background,
  onPress,
  selected,
}: {
  icon?: IconName;
  label: string;
  color?: string;
  background?: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  const body = (
    <View
      style={[
        styles.chip,
        { backgroundColor: background ?? (selected ? colors.ink : colors.card), borderColor: selected ? colors.ink : colors.border },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={selected ? colors.white : color} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.white : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} hitSlop={4}>
      {body}
    </Pressable>
  );
}

export function TagChip({ tag }: { tag: string }) {
  const c = tagColor(tag);
  return (
    <View style={[styles.tag, { backgroundColor: c + '18' }]}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>#{tag}</Text>
    </View>
  );
}

export function SectionTitle({ title, right, tone }: { title: string; right?: ReactNode; tone?: 'danger' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
      <Text style={[type.label, tone === 'danger' && { color: colors.danger }]}>{title}</Text>
      {right}
    </View>
  );
}

export function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`${done} of ${total} done`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct >= 1 ? colors.done : colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>
        {done}
        <Text style={{ color: colors.faint, fontWeight: '700' }}>/{total}</Text>
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: IconName; title: string; message: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={24} color={colors.accent} />
      </View>
      <Text style={type.h2}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center' }]}>{message}</Text>
    </Card>
  );
}

/** Floating "Add a task" bar shown above the tab bar. */
export function QuickAddBar({ onPress, hint = 'Add a task…' }: { onPress: () => void; hint?: string }) {
  return (
    <View pointerEvents="box-none" style={styles.quickWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add a task"
        style={({ pressed }) => [styles.quick, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.quickPlus}>
          <Ionicons name="add" size={20} color={colors.white} />
        </View>
        <Text style={styles.quickText} numberOfLines={1}>
          {hint}
        </Text>
        <Ionicons name="sparkles" size={16} color={colors.ai} />
      </Pressable>
    </View>
  );
}

export function ModalHeader({ title, onClose, right }: { title: string; onClose: () => void; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
        <Ionicons name="close" size={20} color={colors.ink} />
      </Pressable>
      <Text style={type.h2}>{title}</Text>
      <View style={{ minWidth: 36, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#3A2A10',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  button: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: space.lg, justifyContent: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickWrap: { position: 'absolute', left: 0, right: 0, bottom: space.lg, alignItems: 'center', paddingHorizontal: space.lg },
  quick: {
    width: '100%',
    maxWidth: 648,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  quickPlus: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  quickText: { flex: 1, color: '#C9C7CF', fontSize: 15, fontWeight: '500' },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
