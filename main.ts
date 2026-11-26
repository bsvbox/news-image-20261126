// news-image-20261126 — main.ts
// Draws a dense one-page world-news broadsheet for Thursday 26 November 2026.
// Pure Node 22, zero dependencies, no network, fully deterministic: the same
// run always writes the same PNG bytes to /output/entry.png.
// Every story below was reported on 26 November 2026 (wire reports + daily
// briefs checked the morning of the build). No story is carried over from
// 25 November unless the 26 November coverage itself reports it.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [20, 20, 20];
const RED: RGB = [179, 38, 30];
const BLUE: RGB = [26, 77, 143];
const GRAY: RGB = [112, 107, 96];
const WHITE: RGB = [255, 255, 255];
const RULE: RGB = [178, 170, 156];
const CREAM: RGB = [255, 251, 240];

// ---------------------------------------------------------------- font ---
// Hand-built 5x7 bitmap font. '#' is ink, '.' is empty. Uppercase + digits
// + punctuation only; drawText() uppercases everything first.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "01110", "00000", "01110", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

// ------------------------------------------------------------- canvas ----
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
}
function drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
  if (ch === "•") {
    const s = 3 * scale;
    fillRect(x + scale, y + 2 * scale, s, s, c);
    return;
  }
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") fillRect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}
function textWidth(text: string, scale: number): number {
  const t = text.toUpperCase();
  if (t.length === 0) return 0;
  return t.length * 6 * scale - scale;
}
function drawText(x: number, y: number, text: string, scale: number, c: RGB): number {
  const t = text.toUpperCase();
  let cx = x;
  for (const ch of t) {
    drawChar(cx, y, ch, scale, c);
    cx += 6 * scale;
  }
  return cx - x;
}
function drawTextCentered(cx: number, y: number, text: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(text, scale) / 2), y, text, scale, c);
}
function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// -------------------------------------------------------------- png ------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: None
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * stride + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------- stories ----
type Story = { kicker: string; color: RGB; head: string; detail: string };

const LEAD_HEAD = "MACY'S 100TH PARADE MOVES TO SATURDAY";
const LEAD_LINES = [
  "NOR'EASTER SLAMS NYC WITH GUSTS TO 60 MPH; WETTEST THANKSGIVING IN 20+ YEARS.",
  "NBC WILL AIR THE 2025 PARADE INSTEAD; 100 INFLATABLES WAIT FOR SATURDAY, 8:30 AM.",
];

const STORIES: Story[] = [
  { kicker: "US WEATHER", color: RED, head: "NOR'EASTER SLAMS EAST COAST", detail: "High wind warning for NYC; soaking rain, coastal floods." },
  { kicker: "UKRAINE", color: RED, head: "RUSSIA: NEARLY 500,000 WAR DEAD", detail: "Moscow's own figures reveal the toll, leaked papers show." },
  { kicker: "UKRAINE", color: RED, head: "LUKASHENKO OFFERS ZELENSKY A FLIGHT", detail: "\"Am I just a suitcase for him?\" Kyiv leader hits back." },
  { kicker: "UKRAINE", color: RED, head: "POLAND SEEKS NO-FLY ZONE", detail: "Warsaw asks NATO to shoot down Russian missiles." },
  { kicker: "UKRAINE", color: RED, head: "KYIV STRIKES TWO RUSSIAN SHIPS", detail: "Raid off Libya draws a rebuke from Italy." },
  { kicker: "EUROPE", color: BLUE, head: "ENERGY CEASEFIRE WOULD TEST PUTIN", detail: "Von der Leyen: it would show Moscow is serious." },
  { kicker: "GAZA", color: RED, head: "ISRAEL KILLS NEW HAMAS SECURITY CHIEF", detail: "Second senior officer dead in two days." },
  { kicker: "ISRAEL", color: BLUE, head: "JUDGES URGE DROPPING NETANYAHU CHARGES", detail: "Top bribery counts face fresh doubt." },
  { kicker: "GAZA", color: RED, head: "AMNESTY URGES ICC PROBE ON BIRTHS", detail: "Report: measures prevented births since Oct 2023." },
  { kicker: "SPACE", color: BLUE, head: "SHENZHOU-24 CARRIES FIRST FOREIGN FLYER", detail: "Pakistan's Zeeshan Ali heads to Tiangong station." },
  { kicker: "CHINA", color: BLUE, head: "XI GRAFT PROBE FELLS SHANGHAI STAR", detail: "Rising official falls; path to power upended." },
  { kicker: "INDIA", color: BLUE, head: "CONSTITUTION DAY: 6,000 NEW IIT SEATS", detail: "Robotics, AI and space tech get a boost." },
  { kicker: "INDIA", color: BLUE, head: "KEEP HUMANS IN CHARGE OF AI ARMS", detail: "Delhi urges human control over military AI." },
  { kicker: "INDIA", color: BLUE, head: "RS 15,000 CRORE PACKAGE FOR NEPAL", detail: "Modi-Shah talks seal development aid." },
  { kicker: "BANGLADESH", color: BLUE, head: "GARMENT WAGE UP 36 PERCENT", detail: "Minimum pay rises for entry-level workers." },
  { kicker: "BANGLADESH", color: BLUE, head: "HASINA SEEKS RETURN ON DEC 16", detail: "Ex-PM wants to come home next month." },
  { kicker: "ASIA", color: BLUE, head: "N KOREA EXPELS SWISS DIPLOMAT", detail: "Pyongyang orders office shut; Kim defiant." },
  { kicker: "EGYPT", color: RED, head: "30 KILLED IN CAIRO TANKER FIRE", detail: "15 hurt as crash ignites Giza ring road." },
  { kicker: "TRADE", color: RED, head: "US TARIFFS UP TO 35 PCT ON 14 ECONOMIES", detail: "China faces 20 pct; EU, Japan, India hit." },
  { kicker: "MARKETS", color: RED, head: "NASDAQ SINKS NEARLY 4 PCT", detail: "AI fears spread; gold hits record tone." },
  { kicker: "SPORT", color: BLUE, head: "NFL THANKSGIVING TRIPLEHEADER", detail: "Bears-Lions, Eagles-Cowboys, Chiefs-Bills." },
];

const MORE_ITEMS = [
  "SPACEX WINS FCC NOD FOR 1M ORBITAL AI DATA CENTRES",
  "UKRAINE LEGALISES CRYPTO FROM JULY 2027",
  "HERA SENDS CLOSE-UPS OF ASTEROID CRATER",
  "GUKESH VS SINDAROV AT WORLD CHESS IN GENEVA",
  "FLIPKART CEO STEPS DOWN IN DECEMBER",
  "NORWAY VOIDS DISPUTED OIL LICENCES",
  "KENYA: LAST EBOLA PATIENT DISCHARGED",
];

const NUMBERS_LINE_1 = "500K RUSSIAN WAR DEAD  •  $4.71B BITCOIN ETF OUTFLOW  •  88/112 DRONES DOWNED  •  1,220 IPL PLAYERS";
const NUMBERS_LINE_2 = "204 OFF 53 BALLS  •  5.7 QUAKE OFF ANTARCTICA  •  20 HOSTAGES FREED  •  3.8 PCT US INFLATION";

// ----------------------------------------------------------- layout ----
const MX = 24; // margin
const CW = W - MX * 2; // 976 content width

// Faint newsprint dot texture on the bare paper, drawn before any text or
// filled panel so glyphs stay crisp. Deterministic: fixed grid, no random.
function drawPaperTexture(): void {
  const dot: RGB = [238, 233, 220];
  let row = 0;
  for (let y = 4; y < H; y += 7) {
    const x0 = row % 2 === 0 ? 4 : 11;
    for (let x = x0; x < W; x += 14) setPixel(x, y, dot);
    row++;
  }
}

function drawMasthead(): void {
  drawTextCentered(W / 2, 26, "THE WORLD IN ONE PAGE", 6, INK);
  drawTextCentered(W / 2, 78, "THURSDAY, 26 NOVEMBER 2026  -  THANKSGIVING DAY", 2, RED);
  hline(MX, 106, CW, INK, 3);
  hline(MX, 111, CW, INK, 1);
}

function drawBanner(): void {
  fillRect(MX, 118, CW, 34, RED);
  drawTextCentered(
    W / 2,
    128,
    "BREAKING: MACY'S 100TH PARADE MOVED TO SATURDAY AS NOR'EASTER HITS NYC",
    2,
    WHITE,
  );
}

function drawLead(): void {
  const y = 162;
  drawText(MX, y, "LEAD STORY  •  NEW YORK", 1, RED);
  hline(MX, y + 12, CW, RULE, 1);
  const headLines = wrapText(LEAD_HEAD, 4, CW);
  let hy = y + 22;
  for (const ln of headLines) {
    drawText(MX, hy, ln, 4, INK);
    hy += 32;
  }
  let dy = hy + 6;
  for (const ln of LEAD_LINES) {
    const wrapped = wrapText(ln, 2, CW);
    for (const wln of wrapped) {
      drawText(MX, dy, wln, 2, INK);
      dy += 17;
    }
  }
}

function drawCell(x: number, y: number, w: number, h: number, s: Story): void {
  fillRect(x, y, w, h, CREAM);
  hline(x, y, w, INK, 2);
  drawText(x + 8, y + 7, s.kicker, 1, s.color);
  const headLines = wrapText(s.head, 2, w - 16).slice(0, 2);
  let hy = y + 20;
  for (const ln of headLines) {
    drawText(x + 8, hy, ln, 2, INK);
    hy += 17;
  }
  const detLines = wrapText(s.detail, 1, w - 16).slice(0, 2);
  let dy = y + 56;
  for (const ln of detLines) {
    drawText(x + 8, dy, ln, 1, GRAY);
    dy += 10;
  }
}

function drawGrid(): void {
  const top = 302;
  const cols = 3;
  const rows = 7;
  const gapX = 12;
  const gapY = 8;
  const cellW = Math.floor((CW - gapX * (cols - 1)) / cols);
  const cellH = 82;
  for (let i = 0; i < STORIES.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MX + col * (cellW + gapX);
    const y = top + row * (cellH + gapY);
    drawCell(x, y, cellW, cellH, STORIES[i]);
  }
}

function drawMore(): void {
  const y = 926;
  drawText(MX, y, "MORE:", 1, RED);
  const items = MORE_ITEMS.join("  •  ");
  const lines = wrapText(items, 1, CW - 44);
  let ly = y;
  for (const ln of lines.slice(0, 2)) {
    drawText(MX + 44, ly, ln, 1, INK);
    ly += 10;
  }
}

function drawNumbers(): void {
  fillRect(MX, 954, CW, 40, INK);
  drawTextCentered(W / 2, 962, NUMBERS_LINE_1, 1, WHITE);
  drawTextCentered(W / 2, 978, NUMBERS_LINE_2, 1, WHITE);
}

function drawFooter(): void {
  drawTextCentered(
    W / 2,
    1002,
    "ALL STORIES REPORTED THURSDAY 26 NOV 2026  •  IMAGE DRAWN BY CODE, NO NETWORK, NO PHOTOS",
    1,
    GRAY,
  );
}

// -------------------------------------------------------------- main -----
// Re-reads the written PNG and enforces the competition's hard limits:
// valid PNG signature, 1024x1024 dimensions from the IHDR chunk, and a
// file size at or under the 1 MiB cap. Any violation fails the run loudly.
function validateOutput(outPath: string): void {
  const buf = fs.readFileSync(outPath);
  const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(magic)) throw new Error("not a PNG file");
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== W || h !== H) throw new Error(`bad dimensions ${w}x${h}, want ${W}x${H}`);
  if (buf.length > 1024 * 1024) throw new Error(`over 1 MiB cap: ${buf.length} bytes`);
}

function main(): void {
  fill(PAPER);
  drawPaperTexture();
  drawMasthead();
  drawBanner();
  drawLead();
  drawGrid();
  drawMore();
  drawNumbers();
  drawFooter();

  const png = encodePNG(W, H, px);
  const outPrimary = "/output/entry.png";
  const outFallback = path.join("output", "entry.png");
  let outPath = outPrimary;
  try {
    fs.mkdirSync(path.dirname(outPrimary), { recursive: true });
    fs.writeFileSync(outPrimary, png);
  } catch {
    fs.mkdirSync(path.dirname(outFallback), { recursive: true });
    fs.writeFileSync(outFallback, png);
    outPath = outFallback;
  }
  validateOutput(outPath);
  const sha = crypto.createHash("sha256").update(png).digest("hex").slice(0, 16);
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha}...)`);
  console.log(`stories: 1 lead + ${STORIES.length} grid + ${MORE_ITEMS.length} more = ${1 + STORIES.length + MORE_ITEMS.length}`);
}

main();
