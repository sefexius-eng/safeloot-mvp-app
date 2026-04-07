import { ImageResponse } from "next/og";

export const alt = "SafeLoot Marketplace";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at top left, rgba(249,115,22,0.30), transparent 32%), radial-gradient(circle at bottom right, rgba(14,165,233,0.28), transparent 36%), linear-gradient(135deg, #09090b, #18181b)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "84px",
              height: "84px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "24px",
              background: "#f97316",
              boxShadow: "0 24px 60px rgba(249,115,22,0.28)",
              fontSize: "42px",
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: "46px", fontWeight: 700, lineHeight: 1.1 }}>
              SafeLoot
            </div>
            <div
              style={{
                marginTop: "10px",
                fontSize: "20px",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#a1a1aa",
              }}
            >
              Escrow Market
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: "880px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#fdba74",
            }}
          >
            Безопасная сделка
          </div>
          <div
            style={{
              marginTop: "22px",
              fontSize: "64px",
              fontWeight: 700,
              lineHeight: 1.05,
            }}
          >
            Игровые товары и услуги с escrow-защитой
          </div>
          <div
            style={{
              marginTop: "22px",
              fontSize: "28px",
              lineHeight: 1.4,
              color: "#d4d4d8",
            }}
          >
            Покупатель платит безопасно, продавец получает средства только после успешного завершения сделки.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "22px",
            color: "#e4e4e7",
          }}
        >
          <div style={{ display: "flex", gap: "14px" }}>
            <span>Marketplace</span>
            <span style={{ color: "#52525b" }}>•</span>
            <span>Escrow</span>
            <span style={{ color: "#52525b" }}>•</span>
            <span>Safe Payouts</span>
          </div>
          <div style={{ color: "#93c5fd" }}>safeloot</div>
        </div>
      </div>
    ),
    size,
  );
}