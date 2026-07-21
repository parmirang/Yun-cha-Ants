import { type Mood, formatDuration } from "@yca/shared";

const CAPTION: Record<Mood, string> = {
  loss: "만큼 더 벌어야 해..",
  profit: "만큼 안 일해도 돼!",
  even: "딱 본전이야",
};

export function Countdown({ seconds, mood }: { seconds: number; mood: Mood }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span
        className="font-mono text-[2.75rem] font-bold leading-none tracking-tight tabular-nums"
        data-mood={mood}
        style={{ color: "var(--mood-color)" }}
      >
        {formatDuration(seconds)}
      </span>
      <span className="text-sm text-[color:var(--muted)]">{CAPTION[mood]}</span>
    </div>
  );
}
