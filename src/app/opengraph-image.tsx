import { ImageResponse } from "next/og";
import { defaultDescription, siteName } from "@/lib/shared/seo";

export const alt = "Trailgrad AI interview practice";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#3657b4",
          color: "#f1ead8",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          padding: 72,
          position: "relative",
          width: "100%"
        }}
      >
        <div
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(241,234,216,0.1) 1px, transparent 1px), linear-gradient(180deg, rgba(241,234,216,0.1) 1px, transparent 1px)",
            backgroundSize: "88px 88px",
            inset: 0,
            opacity: 0.55,
            position: "absolute"
          }}
        />
        <div
          style={{
            border: "1px solid rgba(241,234,216,0.22)",
            borderRadius: 32,
            inset: 38,
            position: "absolute"
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            position: "relative",
            width: "100%"
          }}
        >
          <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                height: 58,
                justifyContent: "center",
                width: 58
              }}
            >
              {[20, 38, 58, 34, 18].map((height, index) => (
                <div
                  key={index}
                  style={{
                    background: "#f1ead8",
                    borderRadius: 999,
                    height,
                    marginLeft: index === 0 ? 0 : 7,
                    width: 8
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>
              {siteName}
            </div>
          </div>

          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              letterSpacing: "-0.05em",
              lineHeight: 0.95,
              maxWidth: 900
            }}
          >
            AI interview practice built from your resume.
          </div>
          <div
            style={{
              color: "rgba(241,234,216,0.72)",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 850
            }}
          >
            {defaultDescription}
          </div>
        </div>
      </div>
    ),
    size
  );
}
