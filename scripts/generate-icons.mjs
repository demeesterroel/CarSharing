import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";

await mkdir("public/icons", { recursive: true });

// People + Car SVG — paper #f5f0e6 background, ink #1a1a1a strokes
const iconSvg = `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#f5f0e6"/>
  <!-- Three people -->
  <circle cx="62" cy="40" r="11" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M44 72 Q44 56 62 56 Q80 56 80 72" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="100" cy="35" r="12" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M80 68 Q80 52 100 52 Q120 52 120 68" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <circle cx="138" cy="40" r="11" fill="none" stroke="#1a1a1a" stroke-width="4"/>
  <path d="M120 72 Q120 56 138 56 Q156 56 156 72" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/>
  <!-- Car body -->
  <path d="M26 150 L26 139 Q26 133 33 133 L46 133 L59 111 Q66 100 82 98 L120 98 Q138 98 146 111 L159 133 L167 133 Q175 133 175 139 L175 150 Q175 155 169 155 L159 155 Q157 166 146 166 Q135 166 133 155 L69 155 Q67 166 56 166 Q45 166 43 155 L33 155 Q26 155 26 150 Z"
        fill="none" stroke="#1a1a1a" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Car window -->
  <path d="M57 133 L65 113 Q72 103 84 101 L118 101 Q132 101 138 113 L147 133 Z"
        fill="none" stroke="#1a1a1a" stroke-width="3.5" stroke-linejoin="round"/>
  <line x1="101" y1="101" x2="101" y2="133" stroke="#1a1a1a" stroke-width="3.5"/>
  <!-- Wheels -->
  <circle cx="56" cy="158" r="12" fill="none" stroke="#1a1a1a" stroke-width="4.5"/>
  <circle cx="56" cy="158" r="4" fill="#1a1a1a"/>
  <circle cx="146" cy="158" r="12" fill="none" stroke="#1a1a1a" stroke-width="4.5"/>
  <circle cx="146" cy="158" r="4" fill="#1a1a1a"/>
</svg>`;

// Maskable: icon at 75% scale on ink background (Android adaptive icon safe zone)
const maskableSvg = `<svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#1a1a1a"/>
  <g transform="translate(25,25) scale(0.75)">
    <circle cx="62" cy="40" r="11" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M44 72 Q44 56 62 56 Q80 56 80 72" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="100" cy="35" r="12" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M80 68 Q80 52 100 52 Q120 52 120 68" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <circle cx="138" cy="40" r="11" fill="none" stroke="#f5f0e6" stroke-width="5"/>
    <path d="M120 72 Q120 56 138 56 Q156 56 156 72" fill="none" stroke="#f5f0e6" stroke-width="5" stroke-linecap="round"/>
    <path d="M26 150 L26 139 Q26 133 33 133 L46 133 L59 111 Q66 100 82 98 L120 98 Q138 98 146 111 L159 133 L167 133 Q175 133 175 139 L175 150 Q175 155 169 155 L159 155 Q157 166 146 166 Q135 166 133 155 L69 155 Q67 166 56 166 Q45 166 43 155 L33 155 Q26 155 26 150 Z"
          fill="none" stroke="#f5f0e6" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M57 133 L65 113 Q72 103 84 101 L118 101 Q132 101 138 113 L147 133 Z"
          fill="none" stroke="#f5f0e6" stroke-width="4" stroke-linejoin="round"/>
    <line x1="101" y1="101" x2="101" y2="133" stroke="#f5f0e6" stroke-width="4"/>
    <circle cx="56" cy="158" r="12" fill="none" stroke="#f5f0e6" stroke-width="5.5"/>
    <circle cx="56" cy="158" r="4" fill="#f5f0e6"/>
    <circle cx="146" cy="158" r="12" fill="none" stroke="#f5f0e6" stroke-width="5.5"/>
    <circle cx="146" cy="158" r="4" fill="#f5f0e6"/>
  </g>
</svg>`;

const iconBuf     = Buffer.from(iconSvg);
const maskableBuf = Buffer.from(maskableSvg);

await writeFile("public/icons/source.svg", iconSvg);
await sharp(iconBuf).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(iconBuf).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(iconBuf).resize(180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(maskableBuf).resize(512).png().toFile("public/icons/icon-maskable-512.png");

console.log("✓ icon-192.png");
console.log("✓ icon-512.png");
console.log("✓ apple-touch-icon.png");
console.log("✓ icon-maskable-512.png");
console.log("✓ source.svg");
