import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const alt = "SafeLoot Market Preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const imageFile = await readFile(
    path.join(process.cwd(), "public", "og-image.png"),
  );
  const imageDataUrl = `data:image/png;base64,${imageFile.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#000000",
        }}
      >
        <img
          src={imageDataUrl}
          alt="SafeLoot Market Preview"
          width="1200"
          height="630"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    ),
    size,
  );
}