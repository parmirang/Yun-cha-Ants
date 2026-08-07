import { STAGE_COUNT } from "@yca/shared";

/**
 * 옆뷰 픽셀아트 개미. 16x16 그리드를 문자맵으로 정의하고 SVG <rect>로 찍는다.
 *
 * 오른쪽을 보고 있다 — 왼쪽에서 등장할 때는 `flip`으로 뒤집는다.
 * 기어올 때는 몸이 수평(배-가슴-머리)이고, 서면 수직으로 일어난다.
 *
 * 앱이 쓰는 자세는 다섯(crawl1/crawl2 · stand · wave1/wave2)이고, 짤 공장이
 * 파기(dig1/dig2)와 울기(cry1/cry2)를 더 쓴다. **새 자세도 이 파일에 둔다** —
 * 몸을 딴 데서 다시 그리면 앱 개미와 짤 개미가 서서히 다른 벌레가 된다.
 *
 * **몸은 머리·가슴·배 세 덩이다.** 세 덩이는 1픽셀짜리 목과 자루마디로만 잇고,
 * 이 이음매를 덩이보다 반드시 얇게 그린다 — 같은 두께로 이으면 잘록한 허리가
 * 사라지고 통짜 한 덩이로 뭉쳐 보인다. 목과 자루마디는 가슴 색(t)을 그대로 쓴다.
 *
 * **머리가 셋 중 제일 크다.** 실제 개미는 배가 제일 크지만, 그렇게 그리면
 * 16픽셀에서는 머리가 혹처럼 보인다. 캐릭터로 읽히도록 머리 > 배 > 가슴으로 잡았다.
 *
 * **더듬이는 두 개, 다리는 여섯 개다.** 옆뷰라 반대쪽이 가려지지만 개미의 표식이라
 * 둘 다 세어지게 그린다. 기어갈 때는 여섯 다리를 세 쌍으로 묶어 나란히 두고,
 * 서 있을 때는 앞다리 한 쌍이 팔(w)이 되어 2팔 + 4다리로 여섯을 채운다.
 *
 * **입은 얼굴 앞쪽(오른쪽)으로 뾰족하게 튀어나온다.** 머리 앞모서리를 줄마다 한 칸씩
 * 내밀어 부리처럼 각을 세운다 — 이게 없으면 머리가 그냥 둥근 덩어리로만 보인다.
 * 그래서 팔은 머리 위로 들지 않고 앞뒤로 흔든다("영차" 동작). 위로 들면 팔이
 * 부리 옆을 지나면서 부리에 붙어 실루엣이 뭉갠다.
 *
 * **프레임 사이에 바뀌는 건 팔(w)과 다리(l)뿐이다.** 몸통 픽셀은 자세가 같으면
 * 좌표까지 같아야 한다 — 대문은 두 프레임을 겹쳐놓고 번갈아 보여주므로,
 * 몸통이 같이 흔들리면 춤이 아니라 화면이 떨리는 것처럼 보인다.
 *
 *  .  투명   n 더듬이   h 머리   e 눈
 *  t  가슴 (목·자루마디 포함)   w 팔(앞다리)
 *  g  배     G 배 광택          l 다리
 */

export type AntPose =
  | "crawl1"
  | "crawl2"
  | "stand"
  | "wave1"
  | "wave2"
  | "dig1"
  | "dig2"
  | "cry1"
  | "cry2";

const POSES: Record<AntPose, readonly string[]> = {
  /*
   * 기어가기 — 몸이 수평이다. 왼쪽부터 배·자루마디·가슴·목·머리 순이고,
   * 이음매(x5, x9)는 가운데 줄(10)에만 있어서 위아래 줄에 잘록한 틈이 생긴다.
   *
   * 다리 여섯은 전부 가슴에 붙는다 (배에 달면 세 덩이 경계가 다리에 묻힌다).
   * 나란한 두 픽셀이 한 쌍이고, 안쪽 다리가 한 줄 짧아 뒤에 있는 것처럼 보인다.
   * 발끝은 마지막 줄(15)에 닿는다 — 위로 띄우면 바닥선 위에 뜬 것처럼 보인다.
   */
  crawl1: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "............n.n.",
    "...........n.n..",
    "..........n.n...",
    "..........hhh...",
    ".gggg.ttt.hhhh..",
    "ggGGgttttthhehh.",
    ".gggg.ttt.hhhhhh",
    ".....llllllhhh..",
    "....ll.ll.ll....",
    "...ll..ll..ll...",
    "..l....l....l...",
  ],
  crawl2: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "............n.n.",
    "...........n.n..",
    "..........n.n...",
    "..........hhh...",
    ".gggg.ttt.hhhh..",
    "ggGGgttttthhehh.",
    ".gggg.ttt.hhhhhh",
    ".....llllllhhh..",
    ".....ll.ll.ll...",
    "....ll..ll..ll..",
    "....l...l....l..",
  ],
  /*
   * 서기 — 몸이 수직으로 선다. 위에서부터 더듬이(0~1) · 머리(2~5) · 목(6) ·
   * 가슴(7~8) · 자루마디(9) · 배(10~12)이고, 다리 넷은 그 아래 세 줄을 쓴다.
   * 앞다리 한 쌍은 몸 양옆으로 내린 팔(w)이다 — 팔 2 + 다리 4 = 여섯.
   */
  stand: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttw.....",
    "...w.ttttt.w....",
    "...w...t...w....",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  /*
   * 춤 — stand와 몸통은 같고 팔다리만 바뀐다. 한 팔을 앞으로 뻗으면 반대쪽 팔은
   * 내리고, 그에 맞춰 네 다리가 넓게 벌어졌다 좁아진다. 양팔이 같이 움직이면
   * 만세로 보인다 — 엇갈려야 "영차" 하고 밀어 올리는 동작이 된다.
   */
  wave1: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttww....",
    "...w.ttttt..w...",
    "...w...t........",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
    "..l...l.l...l...",
  ],
  wave2: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "...wwtttttw.....",
    "..w..ttttt.w....",
    ".......t...w....",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  /*
   * 땅파기 — stand와 몸통은 같고 **두 팔이 한 몸으로** 앞(오른쪽)을 향해 휘두른다.
   * 팔이 엇갈리면 "영차"(wave)가 되므로, 파는 동작은 두 팔을 겹쳐 한 자루처럼 쓴다.
   *
   * 팔 끝은 가로(dig1) → 비스듬히 아래(dig2)로만 움직인다. 위로 들면 머리 앞으로
   * 튀어나온 입(4번 줄 x10~12) 옆에 붙어 실루엣이 뭉갠다 — wave가 앞뒤로만
   * 흔드는 것과 같은 이유다. 팔 길이는 두 프레임 다 3픽셀로 맞춘다.
   */
  dig1: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    ".....tttttwww...",
    ".....ttttt......",
    ".......t........",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  dig2: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    ".....ttttt......",
    ".....tttttw.....",
    ".......t...w....",
    ".....ggggg..w...",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  /*
   * 울기 — 두 팔을 좌우로 벌려 올렸다(cry1) 축 늘어뜨린다(cry2).
   * 팔 끝을 6번 줄까지만 올리는 것도 입 때문이다: 5번 줄을 비워둬야 입(4번 줄)과
   * 팔 사이에 한 줄이 남는다. 눈물은 스프라이트가 아니라 무대가 눈(e) 좌표에서 그린다 —
   * 눈물 길이가 프레임 수에 매이면 뚝뚝 끊긴다.
   */
  cry1: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    "..w....tt...w...",
    "...wwtttttww....",
    ".....ttttt......",
    ".......t........",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  cry2: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttw.....",
    "...w.ttttt.w....",
    "...w...t...w....",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
};

/** 눈(e) 픽셀의 좌표. 무대가 눈물·땀을 여기서 흘려보낸다. */
export const ANT_EYE = { x: 8, y: 3 } as const;

export const ANT_GRID = 16;

/**
 * 자세마다 그림이 시작되는 줄이 다르다 (기어갈 때는 몸이 낮아 위가 비고,
 * 서면 팔이 맨 윗줄까지 올라간다). 말풍선을 머리 바로 위에 붙이려면
 * 그 빈 줄만큼 내려와야 한다 — 안 그러면 자세가 바뀔 때 말풍선이 붕 뜬다.
 */
const TOP_OFFSETS: Record<AntPose, number> = Object.fromEntries(
  (Object.keys(POSES) as AntPose[]).map((pose) => {
    const first = POSES[pose].findIndex((row) => [...row].some((char) => char !== "."));
    return [pose, (first < 0 ? 0 : first) / ANT_GRID];
  }),
) as Record<AntPose, number>;

/** 스프라이트 상자 위쪽에서 개미 꼭대기까지의 비율 (0~1) */
export function antTopOffset(pose: AntPose): number {
  return TOP_OFFSETS[pose];
}

export interface AntPalette {
  head: string;
  thorax: string;
  gaster: string;
  gloss: string;
  limb: string;
  eye: string;
}

/**
 * 껍질 색의 원본 값. 몸(16×16)과 얼굴(32×32)이 **같은 계산에서 갈라져야** 클로즈업으로
 * 넘어갈 때 같은 개미로 보인다 — 색을 두 곳에서 따로 만들면 얼굴만 서서히 다른 벌레가 된다.
 */
function antTones(stage: number) {
  const t = Math.min(1, Math.max(0, stage / (STAGE_COUNT - 1)));

  return { t, hue: 30 - t * 18, saturation: 8 + t * 54, lightness: 33 + t * 13 };
}

/** resvg는 소수점 hue를 거부하고 fill을 검정으로 떨군다 — 성분을 반드시 반올림해서 넘긴다. */
function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/**
 * 단계(0~49)에 따라 개미 껍질 색을 창백한 회갈색 → 윤기나는 붉은 개미로 보간한다.
 * 손실이 클수록 탈진한 것처럼 채도가 빠지고, 수익이 클수록 불개미처럼 붉어진다.
 *
 * OG 이미지를 굽는 resvg의 hsl() 파서는 소수점 hue를 거부하고 fill을 검정으로
 * 떨군다(브라우저는 멀쩡히 그린다). 모든 성분을 정수로 반올림해서 넘긴다.
 */
export function antPalette(stage: number): AntPalette {
  const { t, hue, saturation, lightness } = antTones(stage);

  return {
    head: hsl(hue, saturation, lightness - 5),
    thorax: hsl(hue, saturation, lightness),
    gaster: hsl(hue, saturation, lightness - 2),
    gloss: hsl(hue, saturation + 8, lightness + 11),
    limb: hsl(hue, saturation, lightness - 13),
    eye: hsl(45, 14 + t * 26, 68 + t * 17),
  };
}

const COLOR_KEY: Record<string, keyof AntPalette> = {
  h: "head",
  t: "thorax",
  // 팔도 결국 앞다리라 다리 색(어두움)을 쓴다. 가슴 색으로 칠하면 가슴에 붙은
  // 팔이 몸통에 묻혀 그냥 넓은 가슴으로 보인다 — 어두워야 팔로 읽힌다.
  w: "limb",
  g: "gaster",
  G: "gloss",
  l: "limb",
  n: "limb",
  e: "eye",
};

/* ── 클로즈업 얼굴 (32×32) ──────────────────────────── */

/**
 * 얼굴만 크게 잡을 때 쓰는 **두 배 해상도** 문자맵.
 *
 * 16×16 몸을 그냥 키우면 눈이 한 칸이라 표정이 없다 — 클로즈업은 도트를 키우는 게
 * 아니라 **더 잘게 쪼개는** 것이라서, 얼굴을 32칸에 따로 그렸다.
 *
 * **이 얼굴만 3/4 측면이다.** 몸은 옆뷰지만, 우는 표정의 핵심은 큼직한 두 눈과 거기
 * 박히는 흰 반짝임이라 옆에서 보면 눈이 하나뿐이라 성립하지 않는다. 정면이어도
 * 개미로 읽히는 건 표식을 그대로 두기 때문이다: 위로 뻗은 더듬이 두 개, 아래턱의
 * 집게(큰턱) 한 쌍, 그리고 몸과 **같은 계산에서 갈라진 껍질 색**(`antTones`).
 *
 * 표정은 우는 개구리 밈에서 가져왔다 — 눈을 얼굴 절반만큼 키우고, 눈동자를 꽉 채운 뒤
 * 흰 반짝임을 큰 것·작은 것 두 개 박는다. 입은 다문 채 지그재그로 떨린다(우는 걸 참는
 * 입). **눈물은 여기 없다** — 줄줄 흐르는 건 시간이 있어야 하는 그림이라 무대가 그린다.
 *
 * **몸(POSES)과 함께 고칠 것.** 얼굴만 고치면 짤 안에서 클로즈업 컷과 전신 컷이
 * 다른 개미가 된다.
 *
 *  .  투명   n 더듬이   H 이마(빛)   h 얼굴   s 턱(그늘)
 *  b  눈꺼풀·큰턱   w 흰자   p 눈동자   g 눈빛   m 다문 입
 */
const FACE: readonly string[] = [
  "..............................................nn....",
  "..............................................nn....",
  "......nn.....................................n......",
  "......nn....................................n.......",
  "........n..................................n........",
  "........n.................................n.........",
  ".........n...............................n..........",
  "..........n............................nn...........",
  "...........n..........................n.............",
  "............n........................n..............",
  "............n.......................n...............",
  ".............n.....................n................",
  "..............n...................n.................",
  "...............n.................n..................",
  "...............n................noooooo.............",
  "................n.............oobbbbbbboo...........",
  ".................n...........obbbbbbbbbbbo..........",
  "................o...........obbbbbbbbbbbbbo.........",
  ".............ooobooo....o..obbbbwwwwwwwbbbbo........",
  "...........oobbbbbbboooohoobbbbwwpppppwwbbbbo.......",
  "..........obbbbbbbbbbbHHhhhbbbwwpppppppwwbbbo.......",
  ".........obbbbwwwwwbbbbHhhbbbwwpgggpppppwwbbbo......",
  ".........obbwwwpppwwwbbHHhbbbwpggggppggppwbbbo......",
  "........obbbwggpppppwbbbHHwwwppggggppggpppwwwo......",
  "........obbwpgggppggpwbbHHwwwpppggpppgppppwwwo......",
  "........owwwpggpppggpwwwHHwwwpppppppppppppwwwo......",
  ".......owwwpppppppppppwwwHwwwpppppppppppppwwwo......",
  ".......oHwwpppppppppppwwHHwwwpppppggppppppwwwo......",
  "......oHHwwpppppppppppwwHHHwwwppppggpppppwwwo.......",
  ".....oHHHwwwpppggppppwwwHHHwwwwpppppppppwwwwo.......",
  ".....oHHHHwwpppgpppppwwHHHHHwwwwpppppppwwwwo........",
  "....oHHHHHwwwpppppppwwwHHHHhhwwwwpppppwwwwhho.......",
  "....oHHHHHHwwwwpppwwwwHHHHHhhhwwwwwwwwwwwhhho.......",
  "...oHHHHHHHHHwwwwwwwHHHHHHHhhhhhwwwwwwwhhhhhho......",
  "...oHHHHHHHHHHHHwHHHHHHHHHHhhhhhhhhhhhhhhhhhho......",
  "...oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho......",
  "..osHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.....",
  "..oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.....",
  "..osHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhho....",
  "..oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho...",
  "..oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho...",
  "..oshhHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhho..",
  ".osshhhhHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhho..",
  "..oshhhhhhHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso.",
  "..osshhhhhhhhhHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhho.",
  "..osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso.",
  "..osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhooooooohhso.",
  "..ossshhhhhhhhhhhhhhhhhhhhhhhhhhhooooooommmmmmmooso.",
  "..ossshhhhhhhhhhhhhhhhhhhhhhooooommmmmmmmmmmmmmmmoso",
  "...ossshhhhhhhhhhhhhhhhhoooommmmmmmmmmmmmmmmmmmmmoo.",
  "...osssshhhhhhhhhhhhhooommmmmmmmmmmmmmmmmmmMMMMMMo..",
  "...osssshhhhhhhhhhooommmmmmmmmmmmmmmmmMMMMMMMMMMMo..",
  "....osssshhhhhhooommmmmmmmmmmmmmmMMMMMMMMMMmmmmmmo..",
  "....ossssshhhoommmmmmmmmmmmmmMMMMMMMMMmmmmmmmmmmmo..",
  ".....ossssooommmmmmmmmmmmMMMMMMMMmmmmmmmmmmmmmmmm...",
  ".....osssommmmmmmmmmmMMMMMMMMmmmmmmmmmmmmmmmmmmmo...",
  "......osommmmmmmmMMMMMMMMmmmmmmmmmmmmmmmmmmmmmoo....",
  ".......ommmmmmMMMMMMMmmmmmmmmmmmmmmmmmmmmmmmmosso...",
  ".........mMMMMMMMmmmmmmmmmmmmmmmmmmmmmmmmmooosso....",
  "..........MMMMmmmmmmmmmmmmmmmmmmmmmmmmmmoosssso.....",
  "...........mmmmmmmmmmmmmmmmmmmmmmmmmmooossssso......",
  "............mmmmmmmmmmmmmmmmmmmmmmooossssssso.......",
  "..............mmmmmmmmmmmmmmmmmooossssssssso........",
  "................mmmmmmmmmmmoooossssssssssoo.........",
  "................oommmmooooossssoooosooooo...........",
  ".............ooottoooooosoooooottooo................",
  "..........oootttttttttttotttttttttttooo.............",
  "........ootttttttttttttttttttttttttttttoo...........",
  ".......ottttttttTtttttttttttttttttttttttto..........",
  ".....oottttttTTTTTTTttttttttttttttttttttttoo........",
  "....otttttttTTTTTTTTTttttttttttttttttttttttto.......",
  "...otttttttTTTTTTTTTTTttttttttttttttttttttttto......",
  "..otttttttTTTTTTTTTTTTTttttttttttttttttttttttto.....",
  ".otttttttTTTTTTTTTTTTTTTttttttttttttttttttttttto....",
  "ottttttttTTTTTTTTTTTTTTTtttttttttttttttttttttttto...",
  "ttttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto..",
  "ttttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto..",
  "ttttttttTTTTTTTTTTTTTTTTTttttttttttttttttttttttttto.",
  "ttttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto",
  "ttttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto",
];

/**
 * 눈을 꽉 감은 프레임 — 눈이 있는 줄(11~18)만 갈아끼운다.
 *
 * 얼굴을 통째로 한 벌 더 두지 않는 건 **머리 윤곽이 갈라지는 걸 막기 위해서다** —
 * 두 벌을 손으로 맞춰두면 한쪽만 고쳤을 때 깜빡일 때마다 얼굴형이 미세하게 튄다.
 */
const FACE_BLINK_FROM = 15;
const FACE_BLINK: readonly string[] = [
  "................n.............oohhhhhhhoo...........",
  ".................n...........ohhhhhhhhhhho..........",
  "................o...........ohhhhhhhhhhhhho.........",
  ".............oooHooo....o..ohhhhhhhhhhhhhhho........",
  "...........ooHHHHHHHoooohoohhhhhhhhhhhhhhhhho.......",
  "..........oHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.......",
  ".........oHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhho......",
  ".........oHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho......",
  "........oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho......",
  "........oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho......",
  "........oHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho......",
  ".......oHHHHHHHHHHHHHHHHHHHhhhhhbbbbbbbhhhhhho......",
  ".......oHHHHHHHHHHHHHHHHHHHhhbbbbbbbbbbbbbhhho......",
  "......oHHHHHHbbbbbbbHHHHHHHbbbbbhhhhhhhbbbbbo.......",
  ".....oHHHHbbbbbbbbbbbbbHHHbbbhhhhhhhhhhhhhbbbo......",
  ".....oHHbbbbbHHHHHHHbbbbbbbHhhhhhhhhhhhhhhhobbo.....",
  "....oHHHbbHHHHHHHHHHHHHbbbHhhhhhhhhhhhhhhhhhobo.....",
  "....oHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhoo......",
  "...oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho......",
  "...oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho......",
];

/**
 * 클로즈업 맵의 크기. **세로가 더 길다** — 얼굴 아래로 몸이 이어져 화면 아래까지 채우고
 * 잘린다. 얼굴만 그리면 머리가 허공에 뜬 흉상이 되므로 몸을 같은 장에 담는다
 * (따로 두면 턱에서 어긋난다).
 */
export const ANT_FACE_W = 52;
export const ANT_FACE_H = 80;

/** 클로즈업 얼굴에서 눈물이 쏟아지는 두 눈의 아래 끝 (얼굴 격자 기준) */
export const ANT_FACE_EYES = [
  { x: 16, y: 34 },
  { x: 35, y: 33 },
] as const;

export interface AntFacePalette {
  head: string;
  highlight: string;
  shade: string;
  brow: string;
  antenna: string;
  sclera: string;
  pupil: string;
  glint: string;
  mouth: string;
  mouthLine: string;
  outline: string;
  body: string;
  bodyGloss: string;
}

export function antFacePalette(stage: number): AntFacePalette {
  const { hue, saturation, lightness } = antTones(stage);

  return {
    head: hsl(hue, saturation, lightness),
    highlight: hsl(hue, saturation, lightness + 14),
    shade: hsl(hue, saturation, lightness - 16),
    brow: hsl(hue, saturation, lightness - 21),
    antenna: hsl(hue, saturation, lightness - 13),
    // 흰자는 껍질 색을 안 따른다 — 탈진한 단계에서 흰자까지 어두워지면 눈이 사라진다.
    sclera: hsl(40, 18, 90),
    pupil: hsl(hue, 26, 13),
    glint: "#ffffff",
    /*
     * 입술은 **껍질과 다른 색**이어야 한다. 본보기 그림이 초록 얼굴에 붉은 입이라 띠가
     * 입으로 읽히는 건데, 갈색 얼굴에 갈색 띠를 그었더니 얼굴을 가로지르는 줄무늬가 됐다.
     * 색상환을 붉은 쪽으로 당기고 채도를 올려 껍질에서 떼어낸다.
     */
    mouth: hsl(hue - 10, saturation + 30, lightness - 4),
    mouthLine: hsl(hue - 12, 30, 9),
    outline: hsl(hue, saturation + 10, 7),
    body: hsl(hue, saturation, lightness - 4),
    bodyGloss: hsl(hue, saturation + 6, lightness + 7),
  };
}

const FACE_KEY: Record<string, keyof AntFacePalette> = {
  n: "antenna",
  o: "outline",
  H: "highlight",
  h: "head",
  s: "shade",
  b: "brow",
  w: "sclera",
  p: "pupil",
  g: "glint",
  m: "mouth",
  M: "mouthLine",
  t: "body",
  T: "bodyGloss",
};

/** 클로즈업 얼굴의 도트 좌표. `blink`면 눈 줄만 감은 것으로 바꿔 찍는다. */
export function antFacePixels(stage: number, blink = false): AntPixel[] {
  const palette = antFacePalette(stage);
  const pixels: AntPixel[] = [];

  FACE.forEach((row, y) => {
    const source =
      blink && y >= FACE_BLINK_FROM && y < FACE_BLINK_FROM + FACE_BLINK.length
        ? (FACE_BLINK[y - FACE_BLINK_FROM] ?? row)
        : row;

    [...source].forEach((char, x) => {
      const key = FACE_KEY[char];
      if (key) pixels.push({ x, y, fill: palette[key] });
    });
  });

  return pixels;
}

export interface AntPixel {
  x: number;
  y: number;
  fill: string;
}

/**
 * 같은 문자맵을 좌표 배열로 뽑는다. 캔버스에 도트로 찍는 쪽(짤 공장)이 쓴다 —
 * SVG도 캔버스도 이 배열 하나에서 나오므로 개미 몸은 한 벌뿐이다.
 */
export function antPixels(stage: number, pose: AntPose = "stand"): AntPixel[] {
  return rects(stage, pose);
}

function rects(stage: number, pose: AntPose): AntPixel[] {
  const palette = antPalette(stage);
  const pixels: { x: number; y: number; fill: string }[] = [];

  POSES[pose].forEach((row, y) => {
    [...row].forEach((char, x) => {
      const key = COLOR_KEY[char];
      if (key) pixels.push({ x, y, fill: palette[key] });
    });
  });

  return pixels;
}

/**
 * 같은 문자맵을 SVG 문자열로 뽑는다.
 * OG 이미지 렌더러(satori)는 SVG 엘리먼트를 직접 못 그리고 <img>만 받으므로,
 * 이걸 data URI로 감싸서 넘긴다.
 */
export function antSvgMarkup(stage: number, pose: AntPose = "stand"): string {
  const body = rects(stage, pose)
    .map(({ x, y, fill }) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANT_GRID} ${ANT_GRID}" shape-rendering="crispEdges">${body}</svg>`;
}

export function antDataUri(stage: number, pose: AntPose = "stand"): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(antSvgMarkup(stage, pose))}`;
}

export function AntSprite({
  stage,
  pose = "stand",
  flip = false,
  className,
}: {
  stage: number;
  pose?: AntPose;
  /** 왼쪽을 보게 뒤집는다 (기본은 오른쪽을 봄) */
  flip?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${ANT_GRID} ${ANT_GRID}`}
      shapeRendering="crispEdges"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      role="img"
      aria-label={`개미 상태 ${stage + 1}단계 / ${STAGE_COUNT}단계`}
    >
      {rects(stage, pose).map(({ x, y, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
      ))}
    </svg>
  );
}
