/**
 * 링크를 클립보드에 넣는다. 넣었으면 true.
 *
 * **`navigator.clipboard`는 보안 컨텍스트(HTTPS·localhost)에서만 존재한다.**
 * 실기기 테스트는 LAN IP(`http://192.168.x.x:3000`)로 들어오는데 거기서는
 * `navigator.clipboard`도 `navigator.share`도 통째로 undefined다 — 그냥 부르면
 * TypeError가 나고, 그게 async 핸들러 안에서 조용히 삼켜져 **버튼이 죽은 것처럼
 * 보인다.** 실제로 "공유하기가 안 눌린다"는 신고가 여기서 나왔다.
 *
 * 그래서 옛 방식(선택 후 execCommand)으로 한 번 더 시도한다. 이쪽은 http에서도
 * 사용자 제스처 안이면 먹는다. 둘 다 실패하면 false를 돌려주고, 호출부가 주소를
 * 사람에게 직접 보여준다 — 조용히 실패하는 길만은 남기지 않는다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한 거부·포커스 없음 등 — 아래 폴백으로 이어간다.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    // 화면 밖으로 밀지 않고 투명하게 둔다 — 밖으로 보내면 iOS가 선택을 못 잡는다.
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.opacity = "0";
    document.body.appendChild(area);

    area.select();
    // iOS Safari는 select()만으로는 범위가 안 잡혀서 한 번 더 지정해야 한다.
    area.setSelectionRange(0, text.length);

    const copied = document.execCommand("copy");
    document.body.removeChild(area);

    return copied;
  } catch {
    return false;
  }
}
