function Row({ color, bar, label }: { color: string; bar?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span
        className="shrink-0"
        style={{
          background: color,
          width: 11,
          height: bar ? 4 : 11,
          borderRadius: bar ? 2 : "50%",
        }}
      />
      {label}
    </div>
  );
}

export default function Legend({ alprOnly }: { alprOnly: boolean }) {
  return (
    <div
      className="glass absolute bottom-4 right-4 z-10 hidden gap-1.5 rounded-xl border border-border p-3 text-[11.5px] shadow-2xl sm:grid"
      aria-label="Map legend"
    >
      <Row color="#ff4d5e" label="Plate reader (ALPR)" />
      {!alprOnly && <Row color="#8b95a7" label="Other camera" />}
      <Row color="#35e0a1" bar label="Least-watched route" />
      <Row color="#9aa4b6" bar label="Fastest route" />
    </div>
  );
}
