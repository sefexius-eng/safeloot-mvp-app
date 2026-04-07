export function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.API_BASE_URL?.replace(/\/api\/?$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "https://safeloot.vercel.app";

  const normalizedUrl = envUrl.trim().replace(/\/+$/, "");

  return /^https?:\/\//i.test(normalizedUrl)
    ? normalizedUrl
    : `https://${normalizedUrl}`;
}