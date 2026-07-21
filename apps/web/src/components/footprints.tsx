"use client";

import type { Mood } from "@yca/shared";
import { useEffect, useState } from "react";

interface Footprint {
  id: number;
  /** 좌우 발. -1 = 왼발, 1 = 오른발 */
  side: -1 | 1;
  mood: Mood;
}

const SPAWN_INTERVAL_MS = 520;
const LIFETIME_MS = 2_600;

/**
 * 개미 뒤로 흘러가며 사라지는 발자국.
 * 국내 시장 관행대로 수익이면 빨강, 손실이면 파랑이다.
 */
export function Footprints({ mood }: { mood: Mood }) {
  const [prints, setPrints] = useState<Footprint[]>([]);

  useEffect(() => {
    let nextId = 0;
    let side: -1 | 1 = -1;

    const timer = setInterval(() => {
      const print: Footprint = { id: nextId++, side, mood };
      side = side === -1 ? 1 : -1;

      setPrints((current) => [...current, print]);
      setTimeout(() => {
        setPrints((current) => current.filter((item) => item.id !== print.id));
      }, LIFETIME_MS);
    }, SPAWN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [mood]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {prints.map((print) => (
        <span
          key={print.id}
          className="ant-footprint"
          data-mood={print.mood}
          // 개미의 두 발 바로 아래에서 태어나 뒤(화면 아래)로 흘러간다.
          style={{ left: `calc(50% + ${print.side * 19}px)` }}
        />
      ))}
    </div>
  );
}
