import { type Mood, decodeShareSnapshot, formatDuration } from "@yca/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Countdown } from "@/components/countdown";
import { EntSprite } from "@/components/ent-sprite";

interface PageProps {
  params: Promise<{ snapshot: string }>;
}

const MOOD: Record<string, Mood> = { l: "loss", p: "profit", e: "even" };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  if (!snapshot) return { title: "영차Ants" };

  const mood = MOOD[snapshot.m] ?? "even";
  const time = formatDuration(snapshot.s);
  const title =
    mood === "loss"
      ? `${time} 만큼 더 벌어야 해..`
      : mood === "profit"
        ? `${time} 만큼 안 일해도 돼!`
        : "딱 본전이야";

  return {
    title: `${title} · 영차Ants`,
    description: `${snapshot.n} — 내 주식, 몇 시간 더 일하면 본전일까?`,
  };
}

export default async function SharePage({ params }: PageProps) {
  const snapshot = decodeShareSnapshot((await params).snapshot);
  if (!snapshot) notFound();

  const mood = MOOD[snapshot.m] ?? "even";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10"
      data-mood={mood}
    >
      <Countdown seconds={snapshot.s} mood={mood} />
      <EntSprite stage={snapshot.g} className="ent-sway h-40 w-40" />

      <p className="text-sm text-[color:var(--muted)]">{snapshot.n}</p>

      <Link className="btn-primary w-full text-center" href="/">
        나도 내 엔트 키우기
      </Link>
    </main>
  );
}
