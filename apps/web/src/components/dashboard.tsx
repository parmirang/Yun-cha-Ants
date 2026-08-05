"use client";

import {
  type Mood,
  type Position,
  type Profile,
  RATE_YEAR,
  averageIn,
  calcPositionStatus,
  encodeShareSnapshot,
  formatWorkSpanWords,
  halfwayAveragingPlan,
  isBroke,
  netHourlyWage,
} from "@yca/shared";
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import {
  formatNumericInput,
  formatPercent,
  formatSignedWon,
  formatWon,
  parseNumericInput,
} from "@/lib/format";
import { shareUrl } from "@/lib/share-url";
import { useLockedBodyScroll } from "@/lib/use-locked-body-scroll";
import { useQuote } from "@/lib/use-quote";

import { CandleScene } from "./candle-scene";
import { Countdown } from "./countdown";
import { nudgeTier, pickNudgeLine } from "./nudge-lines";
import { StageMeter } from "./stage-meter";
import { StoryExportButton } from "./story-export";

export function Dashboard({
  profile,
  position,
  onPositionChange,
  onReset,
}: {
  profile: Profile;
  position: Position;
  onPositionChange: (position: Position) => void;
  onReset: () => void;
}) {
  const quote = useQuote(position.symbol);
  const [averagingOpen, setAveragingOpen] = useState(false);

  // 추가 매수 직후 **뭐가 바뀌었는지** 알리는 줄. 바뀌는 값(평단·수량·수익률)은 전부
  // 화면 맨 아래 카드 안에 있고, 개미를 탭한 자리는 맨 위라 시트를 닫으면 안 바뀌는
  // 것들(카운터·장대봉)만 보인다 — 그래서 "안 먹었다"고 읽힌다. 카드로 데려가서
  // 바뀐 값을 그 자리에서 말해준다.
  const [changeNote, setChangeNote] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!changeNote) return;

    // 시트가 걸어둔 스크롤 잠금은 언마운트 정리에서 원래 위치로 되돌린다. 그 정리가
    // 이 이펙트보다 먼저 도므로 여기서 옮겨야 덮이지 않는다.
    //
    // 부드러운 스크롤은 **모션 감소 설정을 코드로 따로 지켜야 한다** — globals.css의
    // `prefers-reduced-motion` 블록은 CSS 애니메이션만 끄고 이 호출은 그대로 흐른다.
    // 화면이 저 혼자 미끄러지는 건 어지럼증을 부르는 대표적인 움직임이라, 설정을
    // 켜둔 사람에게는 즉시 이동으로 떨어뜨린다 (데려가는 일 자체는 남긴다).
    cardRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });

    const timer = setTimeout(() => setChangeNote(null), 6000);
    return () => clearTimeout(timer);
  }, [changeNote]);

  // 손익을 시간으로 바꿀 때는 실수령 시급으로 나눈다 (profile에는 세전 연봉이 들어있다).
  // 무일푼(연봉 0)이면 shared가 최저임금으로 대신 환산하므로, 그 사실을 화면에 적어준다 —
  // 안 적으면 내 시급으로 계산된 시간인 줄 알게 된다.
  const hourlyWage = netHourlyWage(profile.annualSalary);
  const brokeBasis = isBroke(profile.annualSalary)
    ? `${RATE_YEAR}년 최저시급 기준`
    : undefined;
  const price = quote?.price ?? position.avgPrice;
  const status = calcPositionStatus(position, price, hourlyWage);

  // 현재가가 평단보다 낮으면 물타기, 높으면 불타기 — 계산은 같고 이름만 다르다.
  const averagingLabel = price < position.avgPrice ? "물타기" : "불타기";

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6"
      data-mood={status.mood}
    >
      <Countdown seconds={status.seconds} mood={status.mood} pnl={status.pnl} />

      <section className="my-5">
        <CandleScene
          seconds={status.seconds}
          mood={status.mood}
          stage={status.stage}
          onAntTap={() => {
            track("averaging_open");
            setAveragingOpen(true);
          }}
          antLabel={`${averagingLabel} 계산하기`}
        />
      </section>

      <StageMeter stage={status.stage} />

      <section
        ref={cardRef}
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-4"
        data-changed={changeNote ? "" : undefined}
      >
        <div className="flex items-start justify-between">
          <span className="font-semibold">{position.name}</span>
          {/* 장중 현재가는 아직 없다 — 전일 종가를 현재가로 쓰고, 그 사실을 라벨로 알린다. */}
          <span className="flex flex-col items-end gap-0.5">
            <span className="text-lg font-bold leading-none tabular-nums">
              {formatWon(price)}
            </span>
            <span className="text-[10px] text-[color:var(--muted)]">
              실시간 적용 준비중 · 전일 종가
            </span>
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-[color:var(--muted)]">평단가</dt>
          <dd className="text-right tabular-nums">{formatWon(position.avgPrice)}</dd>

          <dt className="text-[color:var(--muted)]">보유 수량</dt>
          <dd className="text-right tabular-nums">{position.quantity}주</dd>

          <dt className="text-[color:var(--muted)]">평가손익</dt>
          <dd
            className="text-right font-semibold tabular-nums"
            style={{ color: "var(--mood-color)" }}
          >
            {formatSignedWon(status.pnl)} ({formatPercent(status.returnRate)})
          </dd>
        </dl>

        {/* 평소엔 개미를 탭하라는 안내, 추가 매수 직후엔 뭐가 바뀌었는지 알리는 자리.
            한 줄을 나눠 쓰는 건 대답이 질문과 같은 자리에서 나와야 읽히기 때문이다. */}
        {changeNote ? (
          <p
            className="text-center text-xs font-semibold tabular-nums"
            style={{ color: "var(--mood-color)" }}
          >
            {changeNote}
          </p>
        ) : (
          <p className="text-center text-xs text-[color:var(--fg)]">
            {/* 수익이면 더 사도 평단은 올라간다(불타기), 손실이면 내려온다(물타기) —
                방향을 손익에 맞춰야 "평단이 넘어온다"가 거짓말이 안 된다. */}
            {price < position.avgPrice
              ? "개미를 탭하면 몇 주 더 사야 평단이 내려오는지 계산해줄게."
              : "개미를 탭하면 더 살 때 평단이 얼마나 오르는지 계산해줄게."}
          </p>
        )}
      </section>

      <div className="mt-4 flex gap-3">
        <button
          className="btn-ghost"
          onClick={() => {
            track("profile_reset");
            onReset();
          }}
        >
          다시 입력
        </button>
        <ShareButton
          name={position.name}
          seconds={status.seconds}
          stage={status.stage}
          mood={status.mood}
        />
      </div>

      {/* 링크가 안 먹는 데(인스타)로 나갈 때는 링크 대신 이미지를 넘긴다.
          링크 공유가 주(主)라 이쪽은 한 칸 아래에 조용히 둔다. */}
      <StoryExportButton
        name={position.name}
        seconds={status.seconds}
        stage={status.stage}
        mood={status.mood}
      />

      <FooterNote mood={status.mood} seconds={status.seconds} basis={brokeBasis} />

      {averagingOpen && (
        <AveragingSheet
          position={position}
          currentPrice={price}
          hourlyWage={hourlyWage}
          currentSeconds={status.seconds}
          onClose={() => setAveragingOpen(false)}
          onConfirm={(addPrice, addQuantity) => {
            // 물타기/불타기 방향만 남긴다 — 단가도 수량도 안 보낸다.
            track("averaging_confirm", {
              averaging_kind: addPrice < position.avgPrice ? "down" : "up",
            });
            const updated = averageIn(position, addPrice, addQuantity);
            setChangeNote(
              `평단 ${formatWon(position.avgPrice)} → ${formatWon(updated.avgPrice)} · ${updated.quantity}주로 바꿨어`,
            );
            onPositionChange(updated);
            setAveragingOpen(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * 화면 맨 아래. 시간에 맞는 한마디를 띄우고, 그 아래에 이 시간을 무엇으로 나눠
 * 만들었는지 적는다 (내 시급이 아닐 때만).
 */
function FooterNote({
  mood,
  seconds,
  basis,
}: {
  mood: Mood;
  seconds: number;
  basis?: string;
}) {
  const tier = nudgeTier(seconds);
  const [seed, setSeed] = useState(0);

  // 시간 구간이나 손익 방향이 바뀔 때만 새로 뽑는다 — 매 렌더 뽑으면 시세가
  // 들어올 때마다(1초에 한 번) 문장이 갈린다.
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 997));
  }, [tier, mood]);

  return (
    <footer className="mt-auto flex flex-col items-center gap-1 pt-6 text-center">
      <p className="text-sm text-[color:var(--muted)]">
        {pickNudgeLine(mood, seconds, seed)}
      </p>
      {basis && <p className="text-xs text-[color:var(--muted)] opacity-70">{basis}</p>}
    </footer>
  );
}

function ShareButton({
  name,
  seconds,
  stage,
  mood,
}: {
  name: string;
  seconds: number;
  stage: number;
  mood: "loss" | "profit" | "even";
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const token = encodeShareSnapshot({
      n: name,
      s: seconds,
      g: stage,
      m: mood === "loss" ? "l" : mood === "profit" ? "p" : "e",
    });
    const url = shareUrl(token);

    // 모바일에서는 공유 시트를, 데스크톱에서는 클립보드 복사로 떨어진다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "영차Ants", url });
        track("share_click", { share_method: "web_share", mood });
        return;
      } catch {
        // 사용자가 공유 시트를 닫은 경우 — 복사로 이어간다.
      }
    }

    await navigator.clipboard.writeText(url);
    track("share_click", { share_method: "clipboard", mood });
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <button className="btn-primary flex-1" onClick={share}>
      {copied ? "링크 복사됨!" : "공유하기"}
    </button>
  );
}

/**
 * 개미를 탭하면 열리는 추가 매수 계산기.
 *
 * 먼저 답하는 질문은 **"몇 주를 더 사야 평단이 넘어오나"**다 (`halfwayAveragingPlan`).
 * 평단을 현재가까지 끌어내리는 건 불가능하니 목표는 딱 중간이고, 그 수량을 눌러
 * 그대로 채워 넣을 수 있다.
 *
 * 물타기/불타기는 **입력한 단가**가 정한다 — 현재가가 아니다. 사용자가 다른 값을
 * 넣으면 그쪽을 따라가야 확인 버튼 문구가 거짓말을 안 한다.
 */
function AveragingSheet({
  position,
  currentPrice,
  hourlyWage,
  currentSeconds,
  onClose,
  onConfirm,
}: {
  position: Position;
  currentPrice: number;
  hourlyWage: number;
  currentSeconds: number;
  onClose: () => void;
  onConfirm: (price: number, quantity: number) => void;
}) {
  // 초기값·"N주로 채우기"가 넣는 값도 손으로 친 것과 같은 모양이어야 한다 —
  // 쉼표 없는 숫자가 끼면 커서를 대는 순간 표기가 튄다.
  const [priceInput, setPriceInput] = useState(() =>
    formatNumericInput(String(Math.round(currentPrice))),
  );
  const [quantityInput, setQuantityInput] = useState("");

  const price = parseNumericInput(priceInput);
  const quantity = Math.floor(parseNumericInput(quantityInput));
  const valid = price > 0 && quantity > 0;

  const watering = price > 0 && price < position.avgPrice;
  const plan = price > 0 ? halfwayAveragingPlan(position, price) : null;

  // 추가 매수 이후의 상태는 **현재가**로 다시 평가한다 — 산 값이 아니라 지금 값이
  // 손익을 만든다. 계산은 대시보드와 같은 함수를 그대로 쓴다.
  const next = valid ? averageIn(position, price, quantity) : null;
  const preview = next ? calcPositionStatus(next, currentPrice, hourlyWage) : null;

  /*
   * 아래 두 조건은 **다른 질문에 답한다.** 한 변수로 합치면 안 된다.
   *
   * `spanUnchanged` — "화면에 적히는 글자가 그대로인가". 취소선을 그어 같은 문자열을
   *   두 번 적는 걸 막는 **표시** 문제라 적힌 글자로 비교하는 게 맞다.
   * `pnlUnchanged` — "손익 금액이 정말 한 푼도 안 움직이는가". 아래 설명 문단이
   *   "금액은 그대로야"라고 **단언**하므로 실제 값으로 판정해야 한다.
   *
   * 표기는 1근무일(8시간) 단위로 뭉뚱그려지니 글자만 보면 최대 네 시간치 손익 변화가
   * "출근 131번" 안에 숨는다. 그걸 근거로 "금액은 그대로야"라고 적으면 거짓말이 된다.
   *
   * 손익 변화량은 정확히 `(현재가 − 매수 단가) × 추가 수량`이라, 단가가 현재가와 같을
   * 때만 0이다 (수량은 `valid`가 1주 이상을 보장한다). 시트의 기본값이 현재가이므로
   * 열자마자 보이는 화면이 바로 이 경우다.
   */
  const spanUnchanged =
    preview !== null &&
    formatWorkSpanWords(preview.seconds) === formatWorkSpanWords(currentSeconds);
  const pnlUnchanged = preview !== null && price === currentPrice;

  useLockedBodyScroll();

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      {/* 시트 안의 --mood-color는 **추가 매수 이후**의 손익을 따른다 — 바깥 화면의
          지금 손익을 그대로 물려받으면 뒤집히는 순간 색이 거짓말을 한다. */}
      <div
        className="max-h-dvh w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-[color:var(--surface)] p-5 pb-8"
        data-mood={preview?.mood}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 앱이 유저에게 반말로 묻는 목소리를 온보딩("어떤 종목을 샀어?")과 맞춘다.
            "평단 다시 계산"은 이미 있는 걸 고쳐 세는 소리로 들리는데, 이 시트가 답하는
            건 아직 안 산 것에 대한 가정이다. */}
        <h2 className="text-lg font-bold">더 사면 어떻게 될까?</h2>
        <p className="mt-1 text-xs text-[color:var(--muted)] tabular-nums">
          현재가 {formatWon(currentPrice)} · 내 평단 {formatWon(position.avgPrice)}
        </p>

        <div className="mt-4 rounded-xl border border-[color:var(--line)] p-4">
          {plan ? (
            <>
              <p className="text-sm leading-relaxed">
                {formatWon(price)}에{" "}
                <b className="tabular-nums" style={{ color: "var(--mood-color)" }}>
                  {plan.shares}주
                </b>{" "}
                더 사면 평단이{" "}
                <b className="tabular-nums">{formatWon(plan.targetAvg)}</b> — 현재가와의
                차이가 딱 절반으로 줄어.
              </p>
              <p className="mt-1.5 text-xs text-[color:var(--muted)] tabular-nums">
                필요한 돈 {formatWon(plan.cost)}
              </p>
              <button
                className="btn-ghost mt-3 w-full py-2 text-sm"
                onClick={() => setQuantityInput(formatNumericInput(String(plan.shares)))}
              >
                {plan.shares}주 넣어보기
              </button>
            </>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">
              지금 평단이랑 같은 값이면 평단은 안 움직여. 다른 가격을 넣어봐.
            </p>
          )}
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">매수할 주식의 가격 (원)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            value={priceInput}
            onChange={(event) => setPriceInput(formatNumericInput(event.target.value))}
          />
        </label>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs text-[color:var(--muted)]">매수할 주식의 수량 (주)</span>
          <input
            className="rounded-xl border border-[color:var(--line)] bg-transparent px-4 py-3 tabular-nums outline-none"
            inputMode="numeric"
            placeholder={plan ? formatNumericInput(String(plan.shares)) : "10"}
            autoFocus
            value={quantityInput}
            onChange={(event) => setQuantityInput(formatNumericInput(event.target.value))}
          />
        </label>

        <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-[color:var(--muted)]">바뀔 평단</dt>
          <dd className="text-right tabular-nums">
            {next ? formatWon(next.avgPrice) : "—"}
          </dd>

          <dt className="text-[color:var(--muted)]">바뀔 수량</dt>
          <dd className="text-right tabular-nums">{next ? `${next.quantity}주` : "—"}</dd>

          {/* 카운터 큰 글씨와 **같은 자**(근무일)로 적는다 — 여기만 다른 자를 쓰면
              시트를 닫는 순간 같은 손익이 다른 숫자로 보인다. */}
          <dt className="text-[color:var(--muted)]">
            {preview?.mood === "profit" ? "안 나가도 되는 만큼" : "더 일해야 하는 만큼"}
          </dt>
          <dd className="text-right tabular-nums">
            {preview ? (
              spanUnchanged ? (
                // 같은 값을 취소선까지 그어 두 번 적으면 "바뀐다더니 안 바뀐" 꼴이라
                // 화면이 고장 난 것처럼 읽힌다. 안 바뀌면 한 번만 적는다.
                <>
                  {formatWorkSpanWords(preview.seconds)}{" "}
                  <span className="text-[color:var(--muted)]">그대로</span>
                </>
              ) : (
                <>
                  <span className="text-[color:var(--muted)] line-through">
                    {formatWorkSpanWords(currentSeconds)}
                  </span>{" "}
                  <span style={{ color: "var(--mood-color)" }}>
                    {formatWorkSpanWords(preview.seconds)}
                  </span>
                </>
              )
            ) : (
              "—"
            )}
          </dd>
        </dl>

        {/* 추가 매수는 **이미 난 손익을 안 바꾼다** — 손익 변화량은 정확히
            `(현재가 − 매수 단가) × 추가 수량`이라 기본값인 현재가로 사면 0이다.
            그러면 평단·수량만 움직이고 카운터·장대봉·개미는 제자리인데, 그걸 안
            적어두면 시트를 닫은 사용자가 "평단 바꾸기가 안 먹었다"고 읽는다.

            판정은 `spanUnchanged`(적힌 글자)가 아니라 `pnlUnchanged`(실제 금액)다 —
            이 문단은 "금액은 그대로야"라고 단언하므로 표기가 뭉뚱그린 몇 시간치
            차이를 근거로 삼으면 안 된다. 금액이 안 움직이면 손익 방향도 못 뒤집히므로
            아래 `preview.mood`도 지금 화면의 방향과 같다. */}
        {pnlUnchanged && (
          <p className="mt-2.5 text-xs leading-relaxed text-[color:var(--fg)]">
            {/* 앞머리는 "안 바뀐다"는 사실, — 뒤는 **그럼 뭘 바꾸는지**다.
                뒤쪽이 이 시트에서 제일 남아야 할 말이라 노랑으로 굵게 세운다.
                손익색(빨강/파랑)을 쓰면 방향을 뜻하게 되므로 --accent를 쓴다. */}
            {preview?.mood === "profit" ? (
              <>
                평단은 올라가도 수익 금액은 그대로야 —{" "}
                <b className="font-semibold text-[color:var(--accent)]">
                  지금 값에 더 사는 건 앞으로의 오름폭을 키울 뿐이거든.
                </b>
              </>
            ) : (
              <>
                평단은 내려와도 손실 금액은 그대로야 —{" "}
                <b className="font-semibold text-[color:var(--accent)]">
                  물타기는 손실을 지우는 게 아니라, 주가가 오를 때 두 배로 따라잡게 해주는
                  거야.
                </b>
              </>
            )}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button className="btn-ghost flex-1" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary flex-[2] text-sm"
            disabled={!valid}
            onClick={() => onConfirm(price, quantity)}
          >
            {watering ? "설마 물탔어? 평단 바꾸기" : "우와 불탔어? 평단 바꾸기"}
          </button>
        </div>
      </div>
    </div>
  );
}

