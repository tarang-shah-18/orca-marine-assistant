/**
 * Small presentational primitives shared by every screen.
 *
 * React Native has no CSS, so the design system lives here as plain style
 * objects. Anything repeated three or more times is a component; anything else
 * is inlined at the call site.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, riskColor, space } from '../theme';

export const Card = ({ children, style, tone }) => (
  <View
    style={[
      styles.card,
      tone ? { borderColor: `${tone}55`, backgroundColor: `${tone}12` } : null,
      style,
    ]}
  >
    {children}
  </View>
);

export const SectionTitle = ({ children, right }) => (
  <View style={styles.sectionTitleRow}>
    <Text style={styles.sectionTitle}>{String(children).toUpperCase()}</Text>
    {right ?? null}
  </View>
);

export const Badge = ({ label, color = colors.cyan, filled = false, style }) => (
  <View
    style={[
      styles.badge,
      { borderColor: color, backgroundColor: filled ? color : `${color}1a` },
      style,
    ]}
  >
    <Text style={[styles.badgeText, { color: filled ? colors.void : color }]}>{label}</Text>
  </View>
);

export const RiskBadge = ({ level, label, style }) => (
  <Badge label={label ?? level ?? '—'} color={riskColor(level)} style={style} />
);

export const Button = ({ label, onPress, tone = colors.cyan, filled = true, style, disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.button,
      { backgroundColor: filled ? tone : 'transparent', borderColor: tone },
      disabled ? styles.disabled : null,
      style,
    ]}
  >
    <Text style={[styles.buttonText, { color: filled ? colors.void : tone }]}>{label}</Text>
  </TouchableOpacity>
);

export const GhostButton = ({ label, onPress, style }) => (
  <TouchableOpacity onPress={onPress} style={[styles.ghost, style]}>
    <Text style={styles.ghostText}>{label}</Text>
  </TouchableOpacity>
);

/**
 * A label/value row.
 *
 * `mono` is for anything a fisher might want to check with a calculator —
 * distances, heights, wind speeds, times. Everything else is prose.
 */
export const Fact = ({ label, value, mono = true, tone }) => (
  <View style={styles.factRow}>
    <Text style={styles.factLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[
        styles.factValue,
        mono ? styles.mono : null,
        tone ? { color: tone } : null,
      ]}
    >
      {value}
    </Text>
  </View>
);

/** Horizontal meter, used for wave height, wind, safety score and productivity. */
export const Meter = ({ value, max, color = colors.cyan, height = 6 }) => {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <View style={[styles.meterTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

export const Chip = ({ label, onPress, active, disabled, tone = colors.cyan }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.chip,
      active ? { backgroundColor: `${tone}22`, borderColor: tone } : null,
      disabled ? styles.disabled : null,
    ]}
  >
    <Text style={[styles.chipText, active ? { color: tone } : null]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

export const KeyValueGrid = ({ items, columns = 2, tone }) => (
  <View style={styles.grid}>
    {items.map(({ label, value }) => (
      <View key={label} style={[styles.gridCell, { width: `${100 / columns}%` }]}>
        <Text style={styles.gridLabel}>{label}</Text>
        <Text style={[styles.gridValue, tone ? { color: tone } : null]}>{value}</Text>
      </View>
    ))}
  </View>
);

export const Divider = () => <View style={styles.divider} />;

export const Notice = ({ tone = colors.amber, title, children }) => (
  <View style={[styles.notice, { borderColor: `${tone}66`, backgroundColor: `${tone}14` }]}>
    {title ? <Text style={[styles.noticeTitle, { color: tone }]}>{title}</Text> : null}
    <Text style={styles.noticeBody}>{children}</Text>
  </View>
);

export const Empty = ({ title, body }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyTitle}>{title}</Text>
    {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: space.md,
    marginBottom: space.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginRight: 5,
    marginTop: 2,
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  button: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.4 },
  ghost: { paddingVertical: 6, paddingHorizontal: 8 },
  ghostText: { color: colors.cyan, fontSize: 12, fontWeight: '700' },
  factRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 3,
  },
  factLabel: { color: colors.textFaint, fontSize: 11, width: 118 },
  factValue: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 17 },
  mono: { fontVariant: ['tabular-nums'] },
  meterTrack: { backgroundColor: colors.surfaceHigh, overflow: 'hidden', flex: 1 },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderBright,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: colors.surfaceAlt,
    maxWidth: 220,
  },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  gridCell: { paddingVertical: 5, paddingRight: 6 },
  gridLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 0.4, fontWeight: '700' },
  gridValue: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  notice: { borderWidth: 1, borderRadius: 12, padding: space.md, marginVertical: space.sm },
  noticeTitle: { fontSize: 12, fontWeight: '800', marginBottom: 3 },
  noticeBody: { color: colors.textDim, fontSize: 11, lineHeight: 17 },
  empty: { padding: space.xl, alignItems: 'center' },
  emptyTitle: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  emptyBody: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});
