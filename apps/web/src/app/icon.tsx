import { ImageResponse } from "next/og";

import { entDataUri } from "@/components/ent-sprite";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** 파비콘도 같은 스프라이트에서 굽는다 — 별도 아이콘 파일을 따로 관리하지 않는다. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#14100c",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entDataUri(42)} width={58} height={58} alt="" />
      </div>
    ),
    size,
  );
}
