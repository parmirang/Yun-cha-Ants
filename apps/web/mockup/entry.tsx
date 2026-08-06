import { type Mood, decodeShareSnapshot, stageFromSceneLevel } from "@yca/shared";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { AntSprite } from "@/components/ant-sprite";
import { App } from "@/components/app";
import { Countdown } from "@/components/countdown";

const MOOD: Record<string, Mood> = { l: "loss", p: "profit", e: "even" };

/** `#/s/<token>` 이면 공유 화면, 아니면 앱 본체. */
function useShareToken(): string | null {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const match = hash.match(/^#\/s\/(.+)$/);

  return match?.[1] ?? null;
}

function SharedSnapshot({ token }: { token: string }) {
  const snapshot = decodeShareSnapshot(token);

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-sm text-[color:var(--muted)]">
          링크가 깨졌어. 주소를 다시 확인해줘.
        </p>
      </main>
    );
  }

  const mood = MOOD[snapshot.m] ?? "even";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-6 py-10"
      data-mood={mood}
    >
      <Countdown seconds={snapshot.s} mood={mood} />
      <AntSprite stage={stageFromSceneLevel(snapshot.v)} className="ant-sway h-40 w-40" />
      <p className="text-sm text-[color:var(--muted)]">{snapshot.n}</p>
      <button
        className="btn-primary w-full"
        onClick={() => {
          window.location.hash = "";
        }}
      >
        나도 내 개미 키우기
      </button>
    </main>
  );
}

function Root() {
  const token = useShareToken();

  return token ? <SharedSnapshot token={token} /> : <App />;
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<Root />);
