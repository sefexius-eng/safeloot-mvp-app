const DEFAULT_OG_IMAGE_URL =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop";

export async function GET() {
  const response = await fetch(DEFAULT_OG_IMAGE_URL, {
    cache: "force-cache",
    next: {
      revalidate: 60 * 60 * 24,
    },
  });

  if (!response.ok) {
    return new Response("Default OG image is unavailable.", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const imageBuffer = await response.arrayBuffer();

  return new Response(imageBuffer, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}