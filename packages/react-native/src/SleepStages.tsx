/**
 * The stage breakdown under a sleep hypnogram — one row per stage with its
 * swatch, duration and share of the night. Every number comes from the
 * payload's own `sleep.stages`, the same source the web card reads.
 */
import { StyleSheet, Text, View } from "react-native";
import type { GraphPayload, GraphTheme } from "./types";

export function SleepStages({ payload, theme }: { payload: GraphPayload; theme?: GraphTheme }) {
  const stages = payload.sleep?.stages;
  if (!stages?.length) return null;
  const text = theme?.text || payload.theme?.text || "#000000";

  return (
    <View style={styles.list}>
      {stages.map((stage) => {
        const hours = Math.floor(stage.seconds / 3600);
        const minutes = Math.round((stage.seconds % 3600) / 60);
        return (
          <View key={stage.key} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: stage.color }]} />
            <Text style={[styles.label, { color: text }]}>{stage.label}</Text>
            <Text style={[styles.duration, { color: text, opacity: 0.5 }]}>
              {hours ? `${hours}h ` : ""}
              {minutes} min
            </Text>
            <Text style={styles.percent}>{stage.percent}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 10, paddingBottom: 8, paddingTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4 },
  swatch: { width: 11, height: 11, borderRadius: 3 },
  label: { fontSize: 13, fontWeight: "500" },
  duration: { fontSize: 13 },
  percent: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#e6f9eb",
    color: "#007b33",
    overflow: "hidden",
  },
});
