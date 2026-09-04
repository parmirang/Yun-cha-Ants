import { STAGE_COUNT } from "@yca/shared";

/**
 * 옆뷰 픽셀아트 개미. 16x16 그리드를 문자맵으로 정의하고 SVG <rect>로 찍는다.
 *
 * 오른쪽을 보고 있다 — 왼쪽에서 등장할 때는 `flip`으로 뒤집는다.
 * 기어올 때는 몸이 수평(배-가슴-머리)이고, 서면 수직으로 일어난다.
 *
 * **예외는 뒷모습 넷뿐이다** (back1/back2 · backFlail1/backFlail2). 카메라를 등지고
 * 멀어지는 판이 쓰는 자세라 좌우가 대칭이고 `flip`이 뜻을 잃는다 — 그 대신 걸음이
 * 좌우 다리를 번갈아 펴는 것으로 읽힌다. 얼굴이 안 보이니 눈(e)도 없다.
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
  | "cry2"
  | "lookUp"
  | "lookDown"
  | "doze1"
  | "doze2"
  | "jump"
  | "shoot"
  | "prone"
  | "back1"
  | "back2"
  | "backFlail1"
  | "backFlail2"
  | "grip";

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
  /*
   * 올려다보기 / 내려다보기 — stand에서 **머리만 젖히고 숙인다.** 몸통·다리는 좌표까지
   * 그대로다: 시선만 옮기는 자세라 몸이 같이 흔들리면 고개를 든 게 아니라 화면이 튄 것으로
   * 보인다.
   *
   * 머리 방향은 **주둥이가 어디를 가리키느냐**로 읽힌다 — stand에서 오른쪽으로 곧게
   * 뻗은 주둥이(4번 줄)를 위로(lookUp) 아래로(lookDown) 비스듬히 옮긴다. 더듬이도
   * 함께 돈다: 고개를 젖히면 뒤로 눕고, 숙이면 앞으로 선다. 눈은 머리가 도는 만큼
   * 같이 옮겨 늘 주둥이 뒤에 붙어 있는다.
   */
  lookUp: [
    "..n.n.....hh....",
    "...n.n...hhh....",
    "....hhhhhhh.....",
    "....hhhhehh.....",
    "....hhhhhh......",
    ".....hhhh.......",
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
  lookDown: [
    ".....n....n.....",
    "......n..n......",
    ".....hhheh......",
    "....hhhhhhh.....",
    "....hhhhhhhh....",
    ".....hhhhhhh....",
    ".......tt..hh...",
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
   * 꾸벅꾸벅 — 장이 조용해 조는 개미다. **lookUp/lookDown과 같은 손으로 머리만 바꾼다**
   * (몸통·팔·다리는 stand 좌표 그대로). 고개가 반듯한 자리(doze1)와 푹 숙인 자리(doze2)를
   * 갈아끼우면 끄덕이는 것으로 읽힌다 — 숙인 머리는 lookDown 것을 그대로 쓴다.
   *
   * **눈은 `e` 두 칸을 나란히 놓아 감긴 눈("ㅡ")으로 만든다.** 한 칸짜리 점을 지우면
   * 눈이 없는 개미가 되고, 새 문자를 들이면 팔레트 키가 하나 늘어난다 — 옆으로 늘린
   * 한 줄이 곧 감긴 눈이라 둘 다 필요 없다. `ANT_EYE`(8,3)는 여전히 눈 위에 있다.
   */
  doze1: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhheeh.....",
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
  doze2: [
    ".....n....n.....",
    "......n..n......",
    ".....hhhee......",
    "....hhhhhhh.....",
    "....hhhhhhhh....",
    ".....hhhhhhh....",
    ".......tt..hh...",
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
   * 뛰기 — lookUp에서 **다리를 접고 한 팔을 든다.** 발끝이 마지막 줄을 비워야 떠 있는
   * 것으로 읽힌다 (바닥에 닿은 자세와 한 줄 차이로 갈린다).
   *
   * 드는 팔은 **뒤쪽(왼쪽) 팔이다.** 앞쪽 팔을 올리면 머리 앞으로 튀어나온 입 옆에 붙어
   * 실루엣이 뭉갠다 (울기·파기와 같은 제약). 반대쪽 팔은 아래로 흘려 대비를 만든다.
   *
   * 머리는 **stand 것을 쓴다.** 올려다보는 머리(lookUp)를 얹었더니 뒤로 젖힌 더듬이와
   * 든 팔이 같은 칸에 몰려 머리 옆이 점 무더기가 됐다. 그리고 든 팔은 **비스듬히 말고
   * 곧게** 세운다 — 한 칸짜리 대각선은 계단처럼 끊겨 팔로 안 읽힌다.
   */
  jump: [
    "...n......n.....",
    "....n....n......",
    "..ww.hhhh.......",
    "..w.hhhhehh.....",
    "...whhhhhhhhh...",
    "...w.hhhhh......",
    "....w..tt.......",
    ".....tttttw.....",
    ".....ttttt.w....",
    ".......t....w...",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    "....ll...ll.....",
    "...ll.....ll....",
    "................",
  ],
  /*
   * 하트 발사 — stand에서 **앞팔 한 짝만 앞으로 곧게 뻗는다.** 위로 들지 않는 건 늘 같은
   * 이유다: 머리 앞으로 튀어나온 입(4번 줄) 옆에 팔이 붙어 실루엣이 뭉갠다. 뻗는 줄(7)은
   * 입에서 세 줄 아래라 둘이 안 닿는다. 반대쪽 팔은 stand대로 내려 대비를 만든다.
   *
   * **하트는 여기 없다.** 눈물과 같은 자리다 — 날아가는 그림은 시간이 있어야 성립하므로
   * 무대가 손끝(14, 7)에서 띄운다. 문자맵에 박으면 프레임 수만큼만 날아간다.
   */
  shoot: [
    "...n......n.....",
    "....n....n......",
    ".....hhhh.......",
    "....hhhhehh.....",
    "....hhhhhhhhh...",
    ".....hhhhh......",
    ".......tt.......",
    "....wtttttwwww..",
    "...w.ttttt......",
    "...w...t........",
    ".....ggggg......",
    ".....gGGGg......",
    ".....ggggg......",
    ".....ll.ll......",
    "....l.l.l.l.....",
    "...l..l.l..l....",
  ],
  /*
   * 엎드리기 — 기어가기(crawl1)의 수평 몸을 세 줄 내려 **배를 바닥에 붙인** 자세다.
   * 다리는 서 있을 때처럼 세우지 않고 마지막 줄에 납작하게 편다.
   *
   * 머리는 오른쪽 끝에서 **아래를 본다** — 주둥이를 가로로 뻗지 않고 끝을 내려 꺾는다.
   * 가로로 두면 엎드린 채 앞을 보는 그림이라, 아래를 내려다본다는 게 안 남는다.
   */
  prone: [
    "................",
    "................",
    "................",
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
    ".gggg.ttt..hhhhh",
    "..ll..ll.l..hhh.",
  ],
  /*
   * 붙잡기 — 엎드리기(prone)와 몸통·다리·더듬이는 같은 자리에 두고, **머리 위로 완전히
   * 빈 0~7번 줄에 두 팔을 곧게 세워 뻗는다.** 머리 옆(11~14번 줄)에 붙이면 머리 덩이에
   * 먹혀 팔로 안 읽힌다 — 몸에서 완전히 떨어진 빈 자리라야 뻗은 팔 두 짝으로 보인다.
   * 근 팔(15번 칸)은 네 칸 길게, 먼 팔(13번 칸)은 두 칸 짧게 잡아 앞뒤가 갈린다.
   */
  grip: [
    "................",
    "................",
    "................",
    "................",
    "...............w",
    "...............w",
    "............w..w",
    "............w..w",
    "............n.n.",
    "...........n.n..",
    "..........n.n...",
    "..........hhh...",
    ".gggg.ttt.hhhh..",
    "ggGGgttttthhehh.",
    ".gggg.ttt..hhhhh",
    "..ll..ll.l..hhh.",
  ],
  /*
   * 뒷모습 — **이 넷만 옆뷰가 아니다.** 개미가 카메라를 등지고 멀어지는 판(남극 탐험)이
   * 쓴다. 위에서부터 더듬이(0~2) · 머리(3~6) · 가슴(7~9) · 배(10~15)로 쌓이고,
   * 다리 여섯은 가슴 양옆으로 세 쌍이 부챗살처럼 뻗는다 — 뒤에서 보면 앞다리가 몸에
   * 가려지므로, 여섯을 세어지게 하려면 옆으로 펴는 수밖에 없다.
   *
   * **배가 제일 크고 아래에 온다.** 등지고 걸어가는 개미라 배가 카메라에 제일 가깝다 —
   * 옆뷰처럼 배를 뒤로 빼면 위에서 내려다본 그림이 되어 걸어가는 방향이 사라진다.
   *
   * 걸음은 **왼쪽 세 다리와 오른쪽 세 다리를 번갈아 편다**(back1 ↔ back2). 실제 개미의
   * 세다리걸음이기도 하고, 뒤에서 볼 때 앞뒤 움직임이 안 보이므로 좌우 폭이 바뀌는
   * 것으로만 걸음이 읽힌다. **몸통은 좌표까지 그대로 두고 다리만 바꾼다.**
   */
  back1: [
    "..n..........n..",
    "...n........n...",
    "....n......n....",
    "......hhhh......",
    "..l..hhhhhh.....",
    "...l.hhhhhh.....",
    "....l.hhhh.l....",
    ".....tttttt.....",
    "..lllttttttl....",
    "....lttttttl....",
    "...lggggggggl...",
    "..lgggGGGGggg...",
    ".l.gggGGGGggg...",
    "...gggggggggg...",
    "....gggggggg....",
    ".....gggggg.....",
  ],
  back2: [
    "..n..........n..",
    "...n........n...",
    "....n......n....",
    "......hhhh......",
    ".....hhhhhh..l..",
    ".....hhhhhh.l...",
    "....l.hhhh.l....",
    ".....tttttt.....",
    "....lttttttlll..",
    "....lttttttl....",
    "...lggggggggl...",
    "...gggGGGGgggl..",
    "...gggGGGGggg.l.",
    "...gggggggggg...",
    "....gggggggg....",
    ".....gggggg.....",
  ],
  /*
   * 버둥거리기 — 얼음이 깨져 물에 빠진 개미다. 몸은 back1과 같은 자리에 두고
   * **앞다리 한 쌍만 팔(w)로 들어 올린다.** 한쪽은 머리 위까지, 반대쪽은 어깨께까지만
   * 올려 두 프레임에서 서로 바꾼다 — 양팔을 같은 높이로 들면 만세가 되고, 버둥거리는
   * 건 좌우가 엇갈려야 보인다.
   *
   * **뒷모습에서는 팔을 머리 위로 들어도 된다.** 옆뷰가 팔을 못 드는 건 앞으로 뾰족하게
   * 나온 입 옆에 팔이 붙어 실루엣이 뭉개지기 때문인데, 등지고 선 개미에게는 그 입이 없다.
   */
  backFlail1: [
    "..n..........n..",
    "...n........n...",
    "..w.n......n....",
    "...w..hhhh......",
    "...w.hhhhhh.....",
    "....whhhhhh.w...",
    "....w.hhhh.w....",
    ".....tttttt.....",
    "..lllttttttl....",
    "....lttttttl....",
    "...lggggggggl...",
    "..lgggGGGGggg...",
    ".l.gggGGGGggg...",
    "...gggggggggg...",
    "....gggggggg....",
    ".....gggggg.....",
  ],
  backFlail2: [
    "..n..........n..",
    "...n........n...",
    "....n......n.w..",
    "......hhhh..w...",
    ".....hhhhhh.w...",
    "...w.hhhhhhw....",
    "....w.hhhh.w....",
    ".....tttttt.....",
    "....lttttttlll..",
    "....lttttttl....",
    "...lggggggggl...",
    "...gggGGGGgggl..",
    "...gggGGGGggg.l.",
    "...gggggggggg...",
    "....gggggggg....",
    ".....gggggg.....",
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
  /**
   * 순검정. **단계를 안 타는 유일한 색이다** — 나머지는 창백한 개미에서 붉은 개미로
   * 보간되지만 이건 윤곽을 끊거나 그늘을 박는 자리라 어느 단계에서도 같아야 한다.
   * 지금 자세들은 안 쓰고, 도트 랩에서 찍을 수 있게 열어둔 색이다.
   */
  ink: string;
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
    ink: "#000000",
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
  // 어느 자세도 아직 안 쓴다 — 도트 랩에서 윤곽·그늘을 찍을 수 있게 열어둔 글자다.
  K: "ink",
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
  "............................................nn......",
  "............................................nn......",
  "....nn.....................................n........",
  "....nn....................................n.........",
  "......n..................................n..........",
  "......n.................................n...........",
  ".......n...............................n............",
  "........n............................nn.............",
  ".........n..........................n...............",
  "..........n........................n................",
  "..........n.......................n.................",
  "...........n.....................n..................",
  "............n...................n...................",
  ".............n.................n....................",
  ".............n................noooooo...............",
  "..............n.............oobbbbbbboo.............",
  "...............n...........obbbbbbbbbbbo............",
  "..............o...........obbbbbbbbbbbbbo...........",
  "...........ooobooo....o..obbbbwwwwwwwbbbbo..........",
  ".........oobbbbbbboooohoobbbbwwpppppwwbbbbo.........",
  "........obbbbbbbbbbbHHhhhbbbwwpppppppwwbbbo.........",
  ".......obbbbwwwwwbbbbHhhbbbwwpgggpppppwwbbbo........",
  ".......obbwwwpppwwwbbHHhbbbwpggggppggppwbbbo........",
  "......obbbwggpppppwbbbHHwwwppggggppggpppwwwo........",
  "......obbwpgggppggpwbbHHwwwpppggpppgppppwwwo........",
  "......owwwpggpppggpwwwHHwwwpppppppppppppwwwo........",
  ".....owwwpppppppppppwwwHwwwpppppppppppppwwwo........",
  ".....oHwwpppppppppppwwHHLLwppppLLgppppLLwwwo........",
  "....oHHwwpppppppppppwwHHHqLLLLLQQLLLLLQqLLo.........",
  "...oHHHLwwLLLLLppLLLLLHHHqqqqQQQQQQQQQqqqqo.........",
  "...oHHHHLLQQQQQLLQQqqHHHHHqqqqQQQQQQQqqqqo..........",
  "..oHHHHHqqqQQQQQQQqqqHHHHhhqqqqQQQQQqqqqhho.........",
  "..oHHHHHHqqqqQQQqqqqHHHHHhhhqqqqqqqqqqqhhho.........",
  ".oHHHHHHHHHqqqqqqqHHHHHHHhhuuuqqqqqqquuuhhho........",
  ".oHHHHHHHuuuuuquuuuuHHHHHhuuuuuuuuuuuuuuuhho........",
  ".oHHHHHHHuuuuuuuuuuuHHHHHhhuuuuuuuuuuuuuhhho........",
  "osHHHHHHHHHHHuuuHHHHHHHHhhhhhhhuuuuuhhhhhhhho.......",
  "oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.......",
  "osHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhho......",
  "oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho.....",
  "oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho.....",
  "oshhHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhho....",
  "sshhhhHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhho....",
  "oshhhhhhHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhsoo..",
  "osshhhhhhhhhHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhooooommo.",
  "osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoooommmmmmmo.",
  "osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhoooommmmmmmmmmmo.",
  "ossshhhhhhhhhhhhhhhhhhhhhhhhhhhoooommmmmmmmmmmmmmmo.",
  "ossshhhhhhhhhhhhhhhhhhhhhhhoooommmmmmmmmmmmmmmmmmmo.",
  ".ossshhhhhhhhhhhhhhhhhhoooommmmmmmmmmmmmmmmmmmmmMMo.",
  ".osssshhhhhhhhhhhhhhooommmmmmmmmmmmmmmmmmmmmMMMMMMo.",
  ".osssshhhhhhhhhhhooommmmmmmmmmmmmmmmmmmmMMMMMMMMmmo.",
  "..osssshhhhhhhhhommmmmmmmmmmmmmmmmmmMMMMMMMMmmmmmmo.",
  "..ossssshhhhhhhommmmmmmmmmmmmmmmMMMMMMMMmmmmmmmmmmo.",
  "...ossssshhhhhommmmmmmmmmmmmMMMMMMMMmmmmmmmmmmmmmmo.",
  "...osssssshhhhommmmmMMMMMMMMMMMMmmmmmmmmmmmmmmmmmmo.",
  "....ossssssshhoMMMMMMMMMMMMMmmmmmmmmmmmmmmmmmmmmmmo.",
  ".....ossssssssoMMMMMmmmmmmmmmmmmmmmmmmmmmmmmmmmmmo..",
  "......osssssssommmmmmmmmmmmmmmmmmmmmmmmmmmmmmoooo...",
  ".......ossssssommmmmmmmmmmmmmmmmmmmmmmmmmoooo.......",
  "........ossssssommmmmmmmmmmmmmmmmmmmmoooosso........",
  ".........ossssssommmmmmmmmmmmmmmmoooossssso.........",
  "..........oosssssooommmmmmmmooooosssssssso..........",
  "............oossssssoooooooosssssssssssoo...........",
  "..............oosssssssssssssoooosooooo.............",
  "...........ooottoooooosoooooottooo..................",
  "........oootttttttttttotttttttttttooo...............",
  "......ootttttttttttttttttttttttttttttoo.............",
  ".....ottttttttTtttttttttttttttttttttttto............",
  "...oottttttTTTTTTTttttttttttttttttttttttoo..........",
  "..otttttttTTTTTTTTTttttttttttttttttttttttto.........",
  ".otttttttTTTTTTTTTTTttttttttttttttttttttttto........",
  "otttttttTTTTTTTTTTTTTttttttttttttttttttttttto.......",
  "tttttttTTTTTTTTTTTTTTTttttttttttttttttttttttto......",
  "tttttttTTTTTTTTTTTTTTTtttttttttttttttttttttttto.....",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto....",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto....",
  "ttttttTTTTTTTTTTTTTTTTTttttttttttttttttttttttttto...",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto..",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto..",
];

/**
 * 눈을 꽉 감은 프레임 — 눈이 있는 줄(11~18)만 갈아끼운다.
 *
 * 얼굴을 통째로 한 벌 더 두지 않는 건 **머리 윤곽이 갈라지는 걸 막기 위해서다** —
 * 두 벌을 손으로 맞춰두면 한쪽만 고쳤을 때 깜빡일 때마다 얼굴형이 미세하게 튄다.
 */
const FACE_BLINK_FROM = 15;
const FACE_BLINK: readonly string[] = [
  "..............n.............oohhhhhhhoo.............",
  "...............n...........ohhhhhhhhhhho............",
  "..............o...........ohhhhhhhhhhhhho...........",
  "...........oooHooo....o..ohhhhhhhhhhhhhhho..........",
  ".........ooHHHHHHHoooohoohhhhhhhhhhhhhhhhho.........",
  "........oHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.........",
  ".......oHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhho........",
  ".......oHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  ".....oHHHHHHHHHHHHHHHHHHHhhhhhbbbbbbbhhhhhho........",
  ".....oHHHHHHHHHHHHHHHHHHHhhbbbbbbbbbbbbbhhho........",
  "....oHHHHHHbbbbbbbHHHHHHHbbbbbhhhhhhhbbbbbo.........",
  "...oHHHHbbbbbbbbbbbbbHHHbbbhhhhhhhhhhhhhbbbo........",
  "...oHHbbbbbHHHHHHHbbbbbbbHhhhhhhhhhhhhhhhobbo.......",
  "..oHHHbbHHHHHHHHHHHHHbbbHhhhhhhhhhhhhhhhhhobo.......",
  "..oHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhoo........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  "osHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.......",
];

/**
 * 클로즈업 맵의 크기. **세로가 더 길다** — 얼굴 아래로 몸이 이어져 화면 아래까지 채우고
 * 잘린다. 얼굴만 그리면 머리가 허공에 뜬 흉상이 되므로 몸을 같은 장에 담는다
 * (따로 두면 턱에서 어긋난다).
 */
/**
 * 빈 지갑을 본 놀란 얼굴. **머리·각도·몸은 우는 얼굴과 같고 눈·눈썹·입만 다르다** —
 * 그래야 같은 개미가 표정만 바꾼 것으로 읽힌다. 흰자를 넓게 두고 눈동자를 작게 찍어
 * 놀란 눈을 만들고(눈동자는 지갑 쪽인 아래를 본다), 눈썹은 안쪽을 치켜올리고,
 * 입은 다문 띠가 아니라 벌어진 구멍이다.
 */
const FACE_SHOCK: readonly string[] = [
  "............................................nn......",
  "............................................nn......",
  "....nn.....................................n........",
  "....nn....................................n.........",
  "......n..................................n..........",
  "......n.................................n...........",
  ".......n...............................n............",
  "........n............................nn.............",
  ".........n..........................n...............",
  "..........n........................n................",
  "..........n.............o.........n.................",
  "...........n...........oboo.o..o.n..................",
  "............n.....o.o.ooboboboobno.o..o.............",
  "..........o.ono.ooboboboooboboonobobooboo.o.........",
  "......o.oobobnbobobobobo..o.o.nooboboobobobo........",
  ".....obobobobonoboo.o.o.....oobbbbbbbooobobo........",
  ".....oboboo.o.ono..........obbwwwwwwwbboo.o.........",
  "......o.o.....o...........obwwwwwwwwwwwbo...........",
  "...........ooobooo....o..obwwwwwwwwwwwwwbo..........",
  ".........oobwwwwwboooohoobwwwwwwwwwwwwwwwbo.........",
  "........obwwwwwwwwwbHHhhhbwwwwwwwwwwwwwwwbo.........",
  ".......obwwwwwwwwwwwbHhhbwwwwwwwwwwwwwwwwwbo........",
  ".......owwwwwwwwwwwwwHHhwwwwwwwwwwwwwwwwwwwo........",
  "......obwwwwwwwwwwwwwbHHwwwwwwwwppppwwwwwwwo........",
  "......owwwwwwwwwwwwwwwHHwwwwwwwppppppwwwwwwo........",
  "......owwwwwwwwwwwwwwwHHwwwwwwppggppppwwwwwo........",
  ".....owwwwwwwppppwwwwwwHwwwwwwppggppppwwwwwo........",
  ".....oHwwwwwpggpppwwwwHHwwwwwwppppppppwwwwwo........",
  "....oHHwwwwwpggpppwwwwHHHwwwwwwpppppppwwwwo.........",
  "...oHHHwwwwwppppppwwwwHHHwwwwwwppppppwwwwwo.........",
  "...oHHHHwwwwppppppwwwHHHHHwwwwwwwpppwwwwwo..........",
  "..oHHHHHwwwwwppppwwwwHHHHhhwwwwwwwwwwwwwhho.........",
  "..oHHHHHHwwwwwwwwwwwHHHHHhhhwwwwwwwwwwwhhho.........",
  ".oHHHHHHHHHwwwwwwwHHHHHHHhhhhhwwwwwwwhhhhhho........",
  ".oHHHHHHHHHHHHwHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  "osHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.......",
  "oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.......",
  "osHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhho......",
  "oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho.....",
  "oshHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhho.....",
  "oshhHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhho....",
  "sshhhhHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhho....",
  "oshhhhhhHHHHHHHHHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso...",
  "osshhhhhhhhhHhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhho...",
  "osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso...",
  "osshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso...",
  "ossshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhso...",
  "ossshhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhsso..",
  ".ossshhhhhhhhhhhhhhhhhhhhhhhohhhhhhhhhhhhhhhhhhso...",
  ".osssshhhhhhhhhhhhhhhhhhoooomoooohhhhhhhhhhhhhsso...",
  ".osssshhhhhhhhhhhhhhhhoommmmmmmmmoohhhhhhhhhhhsso...",
  "..osssshhhhhhhhhhhhhhommmmmmmmmmmmmohhhhhhhhhssso...",
  "..ossssshhhhhhhhhhhhommmmmMMMMMmmmmmohhhhhhhhssso...",
  "...ossssshhhhhhhhhhommmmMMMMMMMMMmmmmohhhhhhssso....",
  "...osssssshhhhhhhhhommmMMMMMMMMMMMmmmohhhhhsssso....",
  "....ossssssshhhhhhhommMMMMMMMMMMMMMmmohhhhsssso.....",
  ".....osssssssshhhhhommMMMMMMMMMMMMMmmohhsssssso.....",
  "......ossssssssshhhommmMMMMMMMMMMMmmmohsssssso......",
  ".......ossssssssssssommMMMMMMMMMMMmmossssssso.......",
  "........ossssssssssssommmMMMMMMMmmmossssssso........",
  ".........ossssssssssssoommmmmmmmmoossssssso.........",
  "..........oossssssssssssoooomoooosssssssso..........",
  "............oossssssssssssssossssssssssoo...........",
  "..............oosssssssssssssoooosooooo.............",
  "...........ooottoooooosoooooottooo..................",
  "........oootttttttttttotttttttttttooo...............",
  "......ootttttttttttttttttttttttttttttoo.............",
  ".....ottttttttTtttttttttttttttttttttttto............",
  "...oottttttTTTTTTTttttttttttttttttttttttoo..........",
  "..otttttttTTTTTTTTTttttttttttttttttttttttto.........",
  ".otttttttTTTTTTTTTTTttttttttttttttttttttttto........",
  "otttttttTTTTTTTTTTTTTttttttttttttttttttttttto.......",
  "tttttttTTTTTTTTTTTTTTTttttttttttttttttttttttto......",
  "tttttttTTTTTTTTTTTTTTTtttttttttttttttttttttttto.....",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto....",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttto....",
  "ttttttTTTTTTTTTTTTTTTTTttttttttttttttttttttttttto...",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto..",
  "ttttttTTTTTTTTTTTTTTTTTtttttttttttttttttttttttttto..",
];

/** 놀란 얼굴이 눈을 감은 프레임 — 눈이 있는 줄만 갈아끼운다 (우는 얼굴과 같은 방식) */
const FACE_SHOCK_BLINK_FROM = 15;
const FACE_SHOCK_BLINK: readonly string[] = [
  ".....obobobobonoboo.o.o.....oohhhhhhhooobobo........",
  ".....oboboo.o.ono..........ohhhhhhhhhhhoo.o.........",
  "......o.o.....o...........ohhhhhhhhhhhhho...........",
  "...........oooHooo....o..ohhhhhhhhhhhhhhho..........",
  ".........ooHHHHHHHoooohoohhhhhhhhhhhhhhhhho.........",
  "........oHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho.........",
  ".......oHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhhho........",
  ".......oHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhhho........",
  "......oHHHHHHHHHHHHHHHHHHhhhhhbbbbbbbhhhhhho........",
  ".....oHHHHHHHHHHHHHHHHHHHhhhbbbbbbbbbbbhhhho........",
  ".....oHHHHHbbbbbbbHHHHHHHhbbbbhhhhhhhbbbbhho........",
  "....oHHHHbbbbbbbbbbbHHHHHbbbhhhhhhhhhhhbbbo.........",
  "...oHHHbbbbHHHHHHHbbbbHHHbhhhhhhhhhhhhhhhbo.........",
  "...oHHHbbHHHHHHHHHHHbbHHHHhhhhhhhhhhhhhhho..........",
  "..oHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhho.........",
  "..oHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhho.........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
  ".oHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhhhhhhhhhhhho........",
];

export const ANT_FACE_W = 52;
export const ANT_FACE_H = 80;

/** 클로즈업 얼굴에서 눈물이 쏟아지는 두 눈의 아래 끝 (얼굴 격자 기준) */
export const ANT_FACE_EYES = [
  { x: 14, y: 34 },
  { x: 33, y: 33 },
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
  tearPool: string;
  tearDeep: string;
  tearSurface: string;
  wet: string;
  blush: string;
  blushLine: string;
  /** 순검정 — 단계를 안 탄다. 지금 얼굴 맵은 안 쓰고 도트 랩에서 열어둔 색이다. */
  ink: string;
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
    /*
     * 눈에 차오른 눈물. **껍질 단계를 안 따른다** — 눈물은 어느 개미가 울든 같은 물이고,
     * 무대가 흘려보내는 줄기(#4a8fd8·#8fc4f0·#cfe9ff)와 같은 계열이라야 눈에서 흘러나온
     * 물로 이어져 보인다. 흰자 위와 눈동자 위를 다른 밝기로 덮어야 잠긴 눈동자가 비친다.
     */
    tearPool: "#a9d6f5",
    tearDeep: "#3a70a6",
    tearSurface: "#e8f6ff",
    /** 눈 밑 젖은 자리 — 파란 칠이 아니라 젖은 살이라 껍질색에 푸른 기만 섞는다 */
    wet: hsl(hue + 190, 6, lightness + 10),
    /*
     * 상기된 볼. **입술과 같은 방식으로 껍질에서 떼어낸다** — 색상환을 붉은 쪽으로
     * 당기고 채도를 올린다. 딴 색을 새로 지어내면 볼만 다른 재질로 보인다.
     */
    blush: hsl(hue - 6, saturation + 32, lightness + 5),
    blushLine: hsl(hue - 8, saturation + 40, lightness - 2),
    ink: "#000000",
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
  q: "tearPool",
  Q: "tearDeep",
  L: "tearSurface",
  u: "wet",
  // 어느 얼굴도 아직 안 쓴다 — 도트 랩에서 찍을 수 있게 열어둔 글자다.
  K: "ink",
};

/** 놀란 얼굴의 도트 좌표 (빈 지갑 판) */
export function antShockFacePixels(stage: number, blink = false): AntPixel[] {
  const palette = antFacePalette(stage);
  const pixels: AntPixel[] = [];

  FACE_SHOCK.forEach((row, y) => {
    const source =
      blink && y >= FACE_SHOCK_BLINK_FROM && y < FACE_SHOCK_BLINK_FROM + FACE_SHOCK_BLINK.length
        ? (FACE_SHOCK_BLINK[y - FACE_SHOCK_BLINK_FROM] ?? row)
        : row;

    [...source].forEach((char, x) => {
      const key = FACE_KEY[char];
      if (key) pixels.push({ x, y, fill: palette[key] });
    });
  });

  return pixels;
}

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

/** 클로즈업 눈의 상태 — 정면 / 위를 흘긋 / 감음 */
export type AntGaze = "front" | "up" | "closed";

/** 눈에 고인 눈물을 이루는 글자들 */
const TEAR_CHARS = new Set(["q", "Q", "L"]);
/** 고인 눈물이 놓이는 줄 범위 (얼굴 격자). **아래부터 차오른다.** */
const TEAR_TOP = 27;
const TEAR_BOTTOM = 33;
/** 눈 안쪽으로 치는 글자들 — 흘긋 올라간 눈동자는 이 안에서만 그린다 */
const EYE_CHARS = new Set(["w", "p", "g"]);
/** 입술 띠 — 입꼬리는 이 안에서만 움직인다 (밖으로 나가면 얼굴 윤곽이 뚫린다) */
const LIP_CHARS = new Set(["m", "M"]);
/** 볼을 칠할 수 있는 살 글자 */
const SKIN_CHARS = new Set(["h", "H", "s"]);
/** 흘긋 볼 때 눈동자가 올라가는 칸 수 */
const GAZE_LIFT = 2;
/** 입꼬리가 올라가는 최대 칸 수 */
const SMILE_LIFT = 4;
/** 볼 홍조가 앉는 자리 — 가까운 볼(왼쪽)과 먼 볼(오른쪽), 3/4 각도라 크기가 다르다 */
const BLUSH: readonly { cx: number; cy: number; rx: number; ry: number }[] = [
  { cx: 10, cy: 42, rx: 7, ry: 3.6 },
  { cx: 38, cy: 41, rx: 6, ry: 3 },
];

/** 표정을 얹는 값들. 아무것도 안 주면 눈물도 미소도 없는 맨 얼굴이다. */
export interface AntFaceMood {
  /** 눈에 고이는 눈물 (0~1). **흐르지는 않는다** — 흐르는 눈물은 무대가 그린다. */
  welling?: number;
  /** 입꼬리를 올린다 */
  smile?: boolean;
  /** 볼이 발그레 상기된다 */
  blush?: boolean;
}

/**
 * 눈물이 흐르지 않는 클로즈업 — 짤 공장의 책상 세 판(무념무상·안 울어·존버 중)이 쓴다.
 *
 * 우는 얼굴(`FACE`)에서 눈물을 걷어낸 뒤 표정을 다시 얹는다. **얼굴을 표정마다 한 벌씩
 * 그리지 않는다** — 여러 벌을 손으로 맞춰두면 한쪽만 고쳤을 때 표정이 바뀔 때마다
 * 얼굴형이 미세하게 튄다 (깜빡임 프레임과 같은 규칙). 그래서 여기서 하는 일은 전부
 * **원본 맵을 제자리에서 고쳐 쓰는 것**이고, 고칠 수 없는 자리(윤곽 밖·입술 밖)는
 * 건드리지 않아 실루엣이 늘 같다.
 *
 * - `gaze` — "up"이면 눈동자와 눈빛(p·g)만 위로 올려 흘긋 위를 본다. 비운 자리는 흰자로
 *   메우고 **눈꺼풀 위로 나가는 도트는 버린다** (치켜뜬 눈이 아니라 슬쩍 올려다보는 눈).
 * - `mood.welling` — 눈물이 **아래부터** 찬다. 0이면 마른 눈, 1이면 원본만큼 그렁하다.
 *   눈 밑 젖은 살(u)은 늘 말린다 — 아직 한 방울도 안 흘렀기 때문이다.
 * - `mood.smile` — 입술 띠 안에서 입꼬리만 들어 올린다.
 * - `mood.blush` — 두 볼의 살색을 붉은 쪽으로 갈아 끼운다.
 */
export function antFaceCalmPixels(
  stage: number,
  gaze: AntGaze = "front",
  mood: AntFaceMood = {},
): AntPixel[] {
  const palette = antFacePalette(stage);

  /* 감은 눈이면 눈 줄만 갈아끼운 뒤, 이 격자 위에서만 표정을 고친다 */
  const source = FACE.map((row, y) =>
    gaze === "closed" && y >= FACE_BLINK_FROM && y < FACE_BLINK_FROM + FACE_BLINK.length
      ? [...(FACE_BLINK[y - FACE_BLINK_FROM] ?? row)]
      : [...row],
  );

  /* 1. 눈물 — 차오른 높이 아래만 남기고 나머지는 흰자로, 볼은 마른 살로 */
  const fill = Math.min(1, Math.max(0, mood.welling ?? 0));
  const waterline = TEAR_TOP + Math.round((1 - fill) * (TEAR_BOTTOM - TEAR_TOP + 1));
  const grid = source.map((row, y) =>
    row.map((char) => {
      if (char === "u") return "h";
      if (TEAR_CHARS.has(char)) return fill > 0 && y >= waterline ? char : "w";
      return char;
    }),
  );

  /* 2. 미소 — 입술 띠 안에서 양 끝을 들어 올린다 */
  if (mood.smile) liftMouthCorners(grid);

  /* 3. 도트로 편다. 흘긋 올라간 눈동자만 맨 뒤로 미뤄 흰자를 덮게 한다. */
  const pixels: AntPixel[] = [];
  const lifted: AntPixel[] = [];

  grid.forEach((row, y) => {
    row.forEach((char, x) => {
      const key = FACE_KEY[char];
      if (!key) return;

      if (gaze === "up" && (char === "p" || char === "g")) {
        pixels.push({ x, y, fill: palette.sclera });
        const target = grid[y - GAZE_LIFT]?.[x];
        if (target && EYE_CHARS.has(target)) {
          lifted.push({ x, y: y - GAZE_LIFT, fill: palette[key] });
        }
        return;
      }

      pixels.push({ x, y, fill: blushAt(palette, key, char, x, y, mood.blush) });
    });
  });

  return [...pixels, ...lifted];
}

/** 볼 안쪽의 살 도트만 붉게 갈아 끼운다 — 그 밖은 원래 색 그대로 */
function blushAt(
  palette: AntFacePalette,
  key: keyof AntFacePalette,
  char: string,
  x: number,
  y: number,
  on: boolean | undefined,
): string {
  if (!on || !SKIN_CHARS.has(char)) return palette[key];

  for (const cheek of BLUSH) {
    const dx = (x - cheek.cx) / cheek.rx;
    const dy = (y - cheek.cy) / cheek.ry;
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    /* 가운데를 한 톤 더 진하게 — 한 색으로 채우면 볼에 스티커를 붙인 것처럼 보인다 */
    return d < 0.34 ? palette.blushLine : palette.blush;
  }

  return palette[key];
}

/**
 * 입꼬리 올리기. 입술 띠(m·M) 안에서 **입술선(M)만** 위로 민다 — 양 끝일수록 많이,
 * 가운데는 그대로라 선이 활처럼 휜다.
 *
 * **띠 밖으로는 한 도트도 안 나간다.** 올라갈 자리가 입술이 아니면 그 도트는 제자리에
 * 둔다 — 얼굴선이나 윤곽을 뚫으면 웃는 게 아니라 얼굴이 찢어진 그림이 된다.
 */
function liftMouthCorners(grid: string[][]): void {
  const line: { x: number; y: number }[] = [];
  grid.forEach((row, y) =>
    row.forEach((char, x) => {
      if (char === "M") line.push({ x, y });
    }),
  );
  if (line.length === 0) return;

  const xs = line.map((cell) => cell.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  if (right === left) return;

  /* 원본을 그대로 두고 읽어야 한다 — 옮긴 도트를 다시 읽으면 선이 계단째 밀린다 */
  const before = grid.map((row) => [...row]);
  for (const cell of line) {
    const row = grid[cell.y];
    if (row) row[cell.x] = "m";
  }

  for (const cell of line) {
    const t = (cell.x - left) / (right - left);
    /*
     * 양 끝(t=0·1)에서 최대, 한가운데(t=0.5)에서 0. **지수를 낮춰 더 휘게 만들지 말 것** —
     * 1.3제곱으로 눕혀봤더니 이웃한 칸끼리 들리는 높이가 계속 달라져, 입술선이 휘는 게
     * 아니라 **점선처럼 끊어졌다.** 이 선은 눕다시피 한 구간이 길어서 한 칸만 어긋나도
     * 조각난다. 제곱으로 두면 가운데가 평평해 선이 이어지고, 세기는 `SMILE_LIFT`로 키운다.
     */
    const lift = Math.round(SMILE_LIFT * (2 * t - 1) ** 2);
    const up = cell.y - lift;
    const target = lift > 0 && LIP_CHARS.has(before[up]?.[cell.x] ?? "") ? up : cell.y;
    const row = grid[target];
    if (row) row[cell.x] = "M";
  }
}

/* ── 도트 랩으로 여는 창구 ──────────────────────────── */

/**
 * 문자맵과 색표를 **읽기 전용으로** 내보낸다. 도트 랩(`/pixel-lab`)이 여기 있는 자세를
 * 불러다 고치고, 새로 그린 걸 같은 모양의 코드로 뱉기 위해 쓴다.
 *
 * **몸은 여전히 이 파일에만 있다.** 랩은 그림을 복제하지 않고 이 창구로 읽어갈 뿐이라,
 * 자세를 고치면 앱 개미도 랩 개미도 같이 바뀐다 — 랩이 제 사본을 들고 있으면 둘이 갈린다.
 */
export const ANT_POSE_IDS = Object.keys(POSES) as AntPose[];

export function antPoseRows(pose: AntPose): readonly string[] {
  return POSES[pose];
}

/** 클로즈업 얼굴 맵. 눈만 갈아끼우는 깜빡임 조각(FACE_BLINK)은 반쪽이라 안 낸다. */
export const ANT_FACE_ROWS: Readonly<Record<"cry" | "shock", readonly string[]>> = {
  cry: FACE,
  shock: FACE_SHOCK,
};

/** 문자 → 색 이름. 랩의 팔레트가 이 표를 그대로 쓴다 (색표를 두 벌 두지 않는다). */
export const ANT_COLOR_KEY: Readonly<Record<string, keyof AntPalette>> = COLOR_KEY;
export const ANT_FACE_KEY: Readonly<Record<string, keyof AntFacePalette>> = FACE_KEY;

/* ── 큰 개미 (32칸) ──────────────────────────────────────
   **도트를 키우는 게 아니라 쪼갠 몸이다** — 클로즈업 얼굴이 48칸 맵을 따로 두는 것과 같은
   손이다. 16칸 몸을 배율 4로 키우면 도트만 굵어져서, 32칸으로 그린 다른 나라 캐릭터들
   옆에 세우면 개미만 뭉툭하다.

   **그래도 같은 개미다.** 색은 같은 계산(`antPalette`)에서 갈라지고 표식도 그대로다 —
   더듬이 둘, 앞으로 뾰족하게 나온 입, 머리 > 배 > 가슴 세 덩이, 팔 둘 + 다리 넷.
   잘아진 만큼 **눈에 흰자와 눈동자가 들어간다** (16칸에서는 한 점이 전부였다).

   **팔은 몸에 없다.** 파는 동작에서 바뀌는 건 팔뿐이라 따로 두고 어깨에 붙인다 —
   16칸 자세들이 "프레임 사이에 바뀌는 건 팔과 다리뿐"인 것과 같은 규칙이다.
   ────────────────────────────────────────────────────── */

export const ANT_BIG_W = 32;
export const ANT_BIG_H = 32;

const ANT_BIG: readonly string[] = [
  "......n..................n......",
  ".......n................n.......",
  "........n..............n........",
  ".........n............n.........",
  "..........hhhhhhhhhhhh..........",
  "........hhhhhhhhhhhhhhhh........",
  ".......hhhhhhhhhhhhhhhhhh.......",
  "......hhhhhhhhhhhhhhhhhhhh......",
  "......hhhhhhheeehhhhhhhhhh......",
  "......hhhhhhheEehhhhhhhhhhh.....",
  "......hhhhhhheeehhhhhhhhhhhh....",
  "......hhhhhhhhhhhhhhhhhhhhhhh...",
  ".......hhhhhhhhhhhhhhhhhhhh.....",
  "........hhhhhhhhhhhhhhhh........",
  "..........hhhhhhhhhhhh..........",
  "..............tttt..............",
  "..............tttt..............",
  "...........tttttttttt...........",
  "..........tttttttttttt..........",
  "..........tttttttttttt..........",
  "...........tttttttttt...........",
  "..............tttt..............",
  "..........gggggggggggg..........",
  ".........gggggggggggggg.........",
  ".........ggggGGGGGGgggg.........",
  ".........ggggGGGGGGgggg.........",
  ".........gggggggggggggg.........",
  "..........gggggggggggg..........",
  "...........ll......ll...........",
  "..........ll........ll..........",
  ".........ll..........ll.........",
  "........ll............ll........",
];

/** 어깨에서 앞으로 뻗은 팔 (가로) — 파기 첫 프레임 */
const ANT_BIG_ARM_A: readonly string[] = [
  "wwwwwwww",
  ".wwwwwww",
  "..wwwwww",
  "........",
];

/** 비스듬히 내려친 팔 — 파기 둘째 프레임. **위로는 안 든다** (입 옆에 붙어 실루엣이 뭉갠다) */
const ANT_BIG_ARM_B: readonly string[] = [
  "www.....",
  ".www....",
  "..wwww..",
  "...wwww.",
];

/** 팔이 몸에 붙는 자리 (문자맵 좌표) */
export const ANT_BIG_ARM_AT = { x: 20, y: 16 } as const;

const BIG_KEY: Readonly<Record<string, keyof AntPalette>> = {
  n: "limb",
  h: "head",
  E: "eye",
  t: "thorax",
  g: "gaster",
  G: "gloss",
  l: "limb",
  w: "limb",
};

export const ANT_BIG_ROWS = ANT_BIG;
export const ANT_BIG_ARMS: readonly (readonly string[])[] = [ANT_BIG_ARM_A, ANT_BIG_ARM_B];

/**
 * 큰 개미의 문자 → 색. **단계마다의 색은 작은 개미와 같은 계산에서 나온다** — 여기서 색을
 * 새로 지으면 같은 개미가 두 벌이 되어 서서히 다른 벌레가 된다. 흰자만 팔레트에 없는
 * 색이라 따로 박아 넣는다 (껍질이 어느 단계든 흰자는 희다).
 */
export function antBigKey(stage: number): Record<string, string> {
  const palette = antPalette(stage);
  /* 흰자와 순검정만 팔레트에 없는 색이라 따로 박아 넣는다 — 껍질이 어느 단계든 이 둘은
     안 변한다 (검정은 윤곽을 끊거나 그늘을 박는 자리에 쓴다). */
  const key: Record<string, string> = { e: "#f4f2ee", K: "#000000" };

  for (const [char, name] of Object.entries(BIG_KEY)) key[char] = palette[name];

  return key;
}

/* ── 32칸 자세 (BIG_POSES) ──────────────────────────────
   **16칸 자세 스무 개는 안 건드린다.** 앱도 기존 짤도 계속 `POSES`를 쓴다 — 이 표는
   앞으로 새로 만드는 것만 오는 자리라, 여기에 뭘 더해도 이미 있는 화면은 안 움직인다.

   **도트를 키우는 게 아니라 쪼갠 몸이다** (클로즈업 얼굴·`ANT_BIG`과 같은 손) — 배율을
   절반으로 낮춰 화면에 찍히는 크기를 맞추고, 그 안의 도트만 잘아진다.

   **출발점은 앱 서기(`POSES.stand`)를 2×2로 늘린 것이다.** 익숙한 그 개미 모양 그대로
   칸만 네 배로 잘아진 상태에서 사람이 다듬는다 — 처음부터 다시 그리면 같은 개미가 두 벌이
   된다. 그래서 늘린 직후의 이 그림은 **아직 32칸 그림이 아니라 16칸 그림이 앉아 있는
   32칸 격자**다.

   **여기 여덟이 기본 자세다.** 몸이 서로 달라(세로 몸·가로 몸·뒷모습·머리만 다른 것)
   자동 반영으로는 못 만드는 자세들이라 사람이 하나씩 다듬고, 팔다리만 다른 파생 자세
   (손 흔들기·땅파기·울기·뛰기·하트 발사…)는 이 여덟에서 갈라져 나온다.

   색표는 `ANT_BIG`과 같은 `BIG_KEY`다 — 잘아진 격자라 눈에 **흰자(`e`)와 눈동자(`E`)**가
   들어가는 자리이고, 16칸에서 `e`가 뜻하던 노란 눈알 한 점과는 다르다. 늘리기만 한 지금은
   그 한 점이 흰자 네 칸으로 앉아 있으니 눈동자는 사람이 찍어 넣는다.

   `ANT_BIG`(세계의 개미들 짤이 쓰는 32칸 개미)과는 아직 **따로 둔다.** 둘 다 서 있는
   옆뷰라 언젠가 한 벌로 합칠 자리지만, 서기를 다 다듬어 놓고 나란히 봐야 어느 쪽으로
   합칠지가 정해진다.
   ────────────────────────────────────────────────────── */

const BIG_POSES = {
  stand: [
    "......nn............nn..........",
    "......nn............nn..........",
    "........nn........nn............",
    "........nn........nn............",
    "..........hhhhhhhh..............",
    "..........hhhhhhhh..............",
    "........hhhhhhhheehhhh..........",
    "........hhhhhhhheehhhh..........",
    "........hhhhhhhhhhhhhhhhhh......",
    "........hhhhhhhhhhhhhhhhhh......",
    "..........hhhhhhhhhh............",
    "..........hhhhhhhhhh............",
    "..............tttt..............",
    "..............tttt..............",
    "........wwttttttttttww..........",
    "........wwttttttttttww..........",
    "......ww..tttttttttt..ww........",
    "......ww..tttttttttt..ww........",
    "......ww......tt......ww........",
    "......ww......tt......ww........",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........ggGGGGGGgg............",
    "..........ggGGGGGGgg............",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........llll..llll............",
    "..........llll..llll............",
    "........ll..ll..ll..ll..........",
    "........ll..ll..ll..ll..........",
    "......ll....ll..ll....ll........",
    "......ll....ll..ll....ll........",
  ],
  crawl1: [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "........................nn..nn..",
    "........................nn..nn..",
    "......................nn..nn....",
    "......................nn..nn....",
    "....................nn..nn......",
    "....................nn..nn......",
    "....................hhhhhh......",
    "....................hhhhhh......",
    "..gggggggg..tttttt..hhhhhhhh....",
    "..gggggggg..tttttt..hhhhhhhh....",
    "ggggGGGGggtttttttttthhhheehhhh..",
    "ggggGGGGggtttttttttthhhheehhhh..",
    "..gggggggg..tttttt..hhhhhhhhhhhh",
    "..gggggggg..tttttt..hhhhhhhhhhhh",
    "..........llllllllllllhhhhhh....",
    "..........llllllllllllhhhhhh....",
    "........llll..llll..llll........",
    "........llll..llll..llll........",
    "......llll....llll....llll......",
    "......llll....llll....llll......",
    "....ll........ll........ll......",
    "....ll........ll........ll......",
  ],
  prone: [
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "................................",
    "........................nn..nn..",
    "........................nn..nn..",
    "......................nn..nn....",
    "......................nn..nn....",
    "....................nn..nn......",
    "....................nn..nn......",
    "....................hhhhhh......",
    "....................hhhhhh......",
    "..gggggggg..tttttt..hhhhhhhh....",
    "..gggggggg..tttttt..hhhhhhhh....",
    "ggggGGGGggtttttttttthhhheehhhh..",
    "ggggGGGGggtttttttttthhhheehhhh..",
    "..gggggggg..tttttt....hhhhhhhhhh",
    "..gggggggg..tttttt....hhhhhhhhhh",
    "....llll....llll..ll....hhhhhh..",
    "....llll....llll..ll....hhhhhh..",
  ],
  back1: [
    "....nn....................nn....",
    "....nn....................nn....",
    "......nn................nn......",
    "......nn................nn......",
    "........nn............nn........",
    "........nn............nn........",
    "............hhhhhhhh............",
    "............hhhhhhhh............",
    "....ll....hhhhhhhhhhhh..........",
    "....ll....hhhhhhhhhhhh..........",
    "......ll..hhhhhhhhhhhh..........",
    "......ll..hhhhhhhhhhhh..........",
    "........ll..hhhhhhhh..ll........",
    "........ll..hhhhhhhh..ll........",
    "..........tttttttttttt..........",
    "..........tttttttttttt..........",
    "....llllllttttttttttttll........",
    "....llllllttttttttttttll........",
    "........llttttttttttttll........",
    "........llttttttttttttll........",
    "......llggggggggggggggggll......",
    "......llggggggggggggggggll......",
    "....llggggggGGGGGGGGgggggg......",
    "....llggggggGGGGGGGGgggggg......",
    "..ll..ggggggGGGGGGGGgggggg......",
    "..ll..ggggggGGGGGGGGgggggg......",
    "......gggggggggggggggggggg......",
    "......gggggggggggggggggggg......",
    "........gggggggggggggggg........",
    "........gggggggggggggggg........",
    "..........gggggggggggg..........",
    "..........gggggggggggg..........",
  ],
  lookUp: [
    "....nn..nn..........hhhh........",
    "....nn..nn..........hhhh........",
    "......nn..nn......hhhhhh........",
    "......nn..nn......hhhhhh........",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhheehhhh..........",
    "........hhhhhhhheehhhh..........",
    "........hhhhhhhhhhhh............",
    "........hhhhhhhhhhhh............",
    "..........hhhhhhhh..............",
    "..........hhhhhhhh..............",
    "..............tttt..............",
    "..............tttt..............",
    "........wwttttttttttww..........",
    "........wwttttttttttww..........",
    "......ww..tttttttttt..ww........",
    "......ww..tttttttttt..ww........",
    "......ww......tt......ww........",
    "......ww......tt......ww........",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........ggGGGGGGgg............",
    "..........ggGGGGGGgg............",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........llll..llll............",
    "..........llll..llll............",
    "........ll..ll..ll..ll..........",
    "........ll..ll..ll..ll..........",
    "......ll....ll..ll....ll........",
    "......ll....ll..ll....ll........",
  ],
  lookDown: [
    "..........nn........nn..........",
    "..........nn........nn..........",
    "............nn....nn............",
    "............nn....nn............",
    "..........hhhhhheehh............",
    "..........hhhhhheehh............",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhhhhhhhhhh........",
    "........hhhhhhhhhhhhhhhh........",
    "..........hhhhhhhhhhhhhh........",
    "..........hhhhhhhhhhhhhh........",
    "..............tttt....hhhh......",
    "..............tttt....hhhh......",
    "........wwttttttttttww..........",
    "........wwttttttttttww..........",
    "......ww..tttttttttt..ww........",
    "......ww..tttttttttt..ww........",
    "......ww......tt......ww........",
    "......ww......tt......ww........",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........ggGGGGGGgg............",
    "..........ggGGGGGGgg............",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........llll..llll............",
    "..........llll..llll............",
    "........ll..ll..ll..ll..........",
    "........ll..ll..ll..ll..........",
    "......ll....ll..ll....ll........",
    "......ll....ll..ll....ll........",
  ],
  doze1: [
    "......nn............nn..........",
    "......nn............nn..........",
    "........nn........nn............",
    "........nn........nn............",
    "..........hhhhhhhh..............",
    "..........hhhhhhhh..............",
    "........hhhhhhhheeeehh..........",
    "........hhhhhhhheeeehh..........",
    "........hhhhhhhhhhhhhhhhhh......",
    "........hhhhhhhhhhhhhhhhhh......",
    "..........hhhhhhhhhh............",
    "..........hhhhhhhhhh............",
    "..............tttt..............",
    "..............tttt..............",
    "........wwttttttttttww..........",
    "........wwttttttttttww..........",
    "......ww..tttttttttt..ww........",
    "......ww..tttttttttt..ww........",
    "......ww......tt......ww........",
    "......ww......tt......ww........",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........ggGGGGGGgg............",
    "..........ggGGGGGGgg............",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........llll..llll............",
    "..........llll..llll............",
    "........ll..ll..ll..ll..........",
    "........ll..ll..ll..ll..........",
    "......ll....ll..ll....ll........",
    "......ll....ll..ll....ll........",
  ],
  doze2: [
    "..........nn........nn..........",
    "..........nn........nn..........",
    "............nn....nn............",
    "............nn....nn............",
    "..........hhhhhheeee............",
    "..........hhhhhheeee............",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhhhhhhhh..........",
    "........hhhhhhhhhhhhhhhh........",
    "........hhhhhhhhhhhhhhhh........",
    "..........hhhhhhhhhhhhhh........",
    "..........hhhhhhhhhhhhhh........",
    "..............tttt....hhhh......",
    "..............tttt....hhhh......",
    "........wwttttttttttww..........",
    "........wwttttttttttww..........",
    "......ww..tttttttttt..ww........",
    "......ww..tttttttttt..ww........",
    "......ww......tt......ww........",
    "......ww......tt......ww........",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........ggGGGGGGgg............",
    "..........ggGGGGGGgg............",
    "..........gggggggggg............",
    "..........gggggggggg............",
    "..........llll..llll............",
    "..........llll..llll............",
    "........ll..ll..ll..ll..........",
    "........ll..ll..ll..ll..........",
    "......ll....ll..ll....ll........",
    "......ll....ll..ll....ll........",
  ],
} satisfies Record<string, readonly string[]>;

export type AntBigPose = keyof typeof BIG_POSES;

/** 32칸 표의 자세 이름들. 랩 서랍이 이걸로 목록을 만든다. */
export const ANT_BIG_POSE_IDS = Object.keys(BIG_POSES) as AntBigPose[];

export function antBigPoseRows(pose: AntBigPose): readonly string[] {
  return BIG_POSES[pose];
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
