import { tokens } from "@/lib/theme-tokens";

export const shimmerKeyframes = `
@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}
`;

export function ShimmerBar({
  width = "100%",
  height = 14,
  marginBottom = 0,
}: {
  width?: string | number;
  height?: number;
  marginBottom?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 2,
        background: tokens.paperDark,
        animation: "shimmer 1.4s ease-in-out infinite",
        marginBottom,
      }}
    />
  );
}
