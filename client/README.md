This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Notifications Setup

Profile settings now control two delivery channels:

- Email notifications are sent only if the user has `emailNotifications=true` and SMTP is configured.
- Browser push notifications use the Web Notifications API and appear only if the user has `pushNotifications=true` and the browser permission is granted.

For email delivery, configure these environment variables:

```bash
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

## Seed Route Protection

The catalog seed endpoint at `/api/seed` is disabled when `NODE_ENV=production`.

For non-production environments, configure a shared secret before calling it:

```bash
ADMIN_SEED_SECRET=
```

Pass the secret in either the `x-admin-seed-secret` header or the `secret` query parameter.
If you do not need the route, prefer the local script instead:

```bash
npm run seed:catalog
```

## Cosmetics Seed

To populate the cosmetics shop catalog locally, run:

```bash
npm run seed:cosmetics
```

The script is idempotent and updates existing cosmetics by the pair of `name + type` instead of creating duplicates.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
