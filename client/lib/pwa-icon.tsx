import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

async function getSafeLootSymbolDataUrl() {
  const symbolFile = await readFile(
    path.join(process.cwd(), "public", "safeloot-symbol.svg"),
  );

  return `data:image/svg+xml;base64,${symbolFile.toString("base64")}`;
}

export async function createPwaIconResponse(size: number) {
  const symbolDataUrl = await getSafeLootSymbolDataUrl();
  const panelSize = Math.round(size * 0.82);
  const panelRadius = Math.round(size * 0.24);
  const symbolSize = Math.round(size * 0.56);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
        }}
      >
        <div
          style={{
            width: `${panelSize}px`,
            height: `${panelSize}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: `${panelRadius}px`,
            backgroundColor: "#111827",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.08), 0 18px 48px rgba(0,0,0,0.38)",
          }}
        >
          <img
            src={symbolDataUrl}
            alt="SafeLoot"
            width={symbolSize}
            height={symbolSize}
            style={{
              width: `${symbolSize}px`,
              height: `${symbolSize}px`,
            }}
          />
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}