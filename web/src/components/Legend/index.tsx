function Row({
  color,
  bar,
  ring,
  label,
}: {
  color: string;
  bar?: boolean;
  ring?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span
        className="shrink-0"
        style={{
          background: color,
          width: bar ? 11 : ring ? 12 : 11,
          height: bar ? 4 : ring ? 12 : 11,
          borderRadius: bar ? 2 : "50%",
          border: ring ? "2px solid #fff" : undefined,
          boxSizing: "border-box",
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
      <Row color="#f5333f" label="Plate reader (ALPR)" />
      {!alprOnly && <Row color="#8b95a7" label="Other camera" />}
      <Row color="#f5333f" ring label="On selected route (tap a dot for details)" />
      <Row color="#10b981" bar label="Least-watched route" />
      <Row color="#5b53ff" bar label="Fastest route" />
    </div>
  );
}
