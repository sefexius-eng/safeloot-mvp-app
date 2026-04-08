import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

function decodeDataUrlImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const [, contentType, base64Payload] = match;

  try {
    return {
      contentType,
      buffer: Buffer.from(base64Payload, "base64"),
    };
  } catch {
    return null;
  }
}

async function loadFallbackOgImage() {
  const buffer = await readFile(path.join(process.cwd(), "public", "og-image.png"));

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const product = await prisma.product.findUnique({
      where: {
        id,
      },
      select: {
        images: true,
      },
    });

    const firstImage = product?.images.find((image) => image.trim());

    if (!firstImage) {
      return loadFallbackOgImage();
    }

    const decodedImage = decodeDataUrlImage(firstImage);

    if (!decodedImage) {
      return loadFallbackOgImage();
    }

    return new Response(decodedImage.buffer, {
      headers: {
        "Content-Type": decodedImage.contentType,
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("[PRODUCT_OG_IMAGE_ROUTE_ERROR]", error);

    return loadFallbackOgImage();
  }
}