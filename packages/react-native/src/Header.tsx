/**
 * The card chrome above the chart: icon, title, date range, status badge and
 * the header stats.
 *
 * On the web this is `innerHTML` string assembly styled by a stylesheet. The
 * The layout is ported rather than shared, because there is nothing to share —
 * RN has no CSS. The numbers come from ./stats, which is held to the web
 * renderer's own formatters by test/header.test.mjs.
 */
import { StyleSheet, Text, View } from "react-native";
import { headerStats } from "./stats";
import type { GraphPayload, GraphTheme } from "./types";

/** Matches the renderer's own defaults so an unthemed payload still reads. */
const DEFAULTS = { bg: "#FFFFFF", text: "#000000" };

/** The header glyphs, as the emoji-free coloured dots the web build draws as
 *  SVGs. Same hues, so a graph looks like itself across platforms. */
const ICON_COLOURS: Record<string, string> = {
  heart: "#E5484D",
  activity: "#6366F1",
  steps: "#3a82f6",
  oxygen: "#06b6d4",
  sleep: "#6FCF97",
  body: "#3a82f6",
  nutrition: "#E8A33A",
};

const BADGE: Record<string, { bg: string; fg: string }> = {
  good: { bg: "#e6f9eb", fg: "#007b33" },
  warn: { bg: "#fff4e5", fg: "#b25f00" },
  bad: { bg: "#fdecec", fg: "#c62828" },
  neutral: { bg: "rgba(127,127,127,0.12)", fg: "#555" },
};

export function Header({ payload, theme }: { payload: GraphPayload; theme?: GraphTheme }) {
  const text = theme?.text || payload.theme?.text || DEFAULTS.text;
  const dim = (opacity: number) => ({ color: text, opacity });
  const stats = headerStats(payload);
  const badge = payload.status ? (BADGE[payload.status.tone ?? "good"] ?? BADGE.good!) : null;
  const iconColour = payload.icon ? ICON_COLOURS[payload.icon] : undefined;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.titleRow}>
          {iconColour && <View style={[styles.icon, { backgroundColor: iconColour }]} />}
          <Text numberOfLines={1} style={[styles.title, dim(0.7)]}>
            {payload.title}
          </Text>
        </View>
        {badge && payload.status && (
          <Text style={[styles.badge, { backgroundColor: badge.bg, color: badge.fg }]}>
            {payload.status.text}
          </Text>
        )}
      </View>

      {/* A day-aligned date range is meaningless for a single session, which is
          framed on a within-session axis — so it follows the web and hides. */}
      {!!payload.subtitle && !payload.axisMode && (
        <Text numberOfLines={1} style={[styles.subtitle, dim(0.45)]}>
          {payload.subtitle}
        </Text>
      )}

      {stats.length > 0 && (
        <View style={styles.stats}>
          {stats.map((s, i) => (
            <View key={`${s.label}-${i}`} style={styles.stat}>
              <Text style={[styles.statValue, { color: text }]}>
                {s.value}
                {!!s.unit && <Text style={[styles.statUnit, dim(0.45)]}>{s.unit}</Text>}
              </Text>
              {!!s.label && <Text style={[styles.statLabel, dim(0.45)]}>{s.label}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  icon: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 15, fontWeight: "500", letterSpacing: -0.15, flexShrink: 1 },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
  },
  subtitle: { marginTop: 1, fontSize: 11, fontWeight: "500" },
  stats: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 20, marginTop: 4 },
  stat: { flexDirection: "column" },
  statValue: { fontSize: 26, fontWeight: "600", letterSpacing: -0.5, lineHeight: 28 },
  statUnit: { fontSize: 13, fontWeight: "400" },
  statLabel: { fontSize: 12, marginTop: 1 },
});
