import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1976d2" rx="64"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="white" font-family="sans-serif">🚗</text>
</svg>`;

const svgBuffer = Buffer.from(svg);
await sharp(svgBuffer).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(svgBuffer).resize(512).png().toFile("public/icons/icon-512.png");
console.log("Icons generated");
