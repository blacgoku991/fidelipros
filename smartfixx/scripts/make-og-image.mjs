/**
 * Génère public/og-image.png (1200 × 630) — l'aperçu affiché quand le lien est
 * partagé sur LinkedIn, WhatsApp, Slack, X… Ces plateformes n'acceptent pas le
 * SVG, il faut donc un raster.
 *
 * À relancer seulement si l'accroche ou l'identité change :
 *   npm i -D playwright && node scripts/make-og-image.mjs
 *
 * Playwright n'est pas une dépendance du projet : l'image est versionnée, le
 * build de production n'a pas besoin d'un navigateur.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.resolve("public/og-image.png");
const FONT_DIR = path.resolve("public/fonts");

const asDataUri = async (file) =>
  `data:font/woff2;base64,${(await readFile(path.join(FONT_DIR, file))).toString("base64")}`;

const page = async () => {
  const grotesk600 = await asDataUri("space-grotesk-600-latin.woff2");
  const grotesk700 = await asDataUri("space-grotesk-700-latin.woff2");
  const inter400 = await asDataUri("inter-400-latin.woff2");
  const mono500 = await asDataUri("jetbrains-mono-500-latin.woff2");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Space Grotesk'; font-weight: 600; src: url('${grotesk600}') format('woff2'); }
  @font-face { font-family: 'Space Grotesk'; font-weight: 700; src: url('${grotesk700}') format('woff2'); }
  @font-face { font-family: 'Inter'; font-weight: 400; src: url('${inter400}') format('woff2'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 500; src: url('${mono500}') format('woff2'); }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #04050A; overflow: hidden;
         font-family: Inter, sans-serif; position: relative; }

  .glow-a { position: absolute; width: 760px; height: 760px; right: -180px; top: -220px;
            background: radial-gradient(circle, rgba(139,92,255,0.30), transparent 63%); filter: blur(20px); }
  .glow-b { position: absolute; width: 640px; height: 640px; right: 60px; bottom: -280px;
            background: radial-gradient(circle, rgba(79,240,212,0.24), transparent 62%); filter: blur(20px); }
  .grid { position: absolute; inset: 0;
          background-image: linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: linear-gradient(115deg, #000 20%, transparent 78%); }

  .wrap { position: relative; padding: 74px 80px; height: 100%; display: flex; flex-direction: column; }

  .brand { display: flex; align-items: center; gap: 16px; }
  .brand span { font-family: 'Space Grotesk'; font-weight: 600; font-size: 34px; color: #fff; letter-spacing: -0.02em; }
  .brand .fx { background: linear-gradient(100deg, #4FF0D4, #8B5CFF);
               -webkit-background-clip: text; background-clip: text; color: transparent; }

  h1 { font-family: 'Space Grotesk'; font-weight: 700; font-size: 92px; line-height: 0.97;
       letter-spacing: -0.045em; color: #fff; margin-top: auto; }
  h1 .grad { background: linear-gradient(100deg, #ffffff 0%, #b9f7ec 40%, #a985ff 82%);
             -webkit-background-clip: text; background-clip: text; color: transparent; }

  p { font-size: 27px; line-height: 1.45; color: #C3CBDE; margin-top: 26px; max-width: 880px; }

  .tags { display: flex; gap: 12px; margin-top: 40px; }
  .tag { font-family: 'JetBrains Mono'; font-weight: 500; font-size: 14.5px; letter-spacing: 0.13em;
         text-transform: uppercase; color: #7E88A3; border: 1px solid rgba(255,255,255,0.13);
         border-radius: 999px; padding: 11px 20px; }

  .rule { position: absolute; left: 0; right: 0; bottom: 0; height: 5px;
          background: linear-gradient(90deg, #4FF0D4, #8B5CFF 55%, #FF5C8A); }
</style></head>
<body>
  <div class="glow-a"></div><div class="glow-b"></div><div class="grid"></div>

  <div class="wrap">
    <div class="brand">
      <svg width="52" height="52" viewBox="0 0 44 44" fill="none">
        <defs>
          <linearGradient id="f" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stop-color="#4FF0D4"/><stop offset=".55" stop-color="#8B5CFF"/><stop offset="1" stop-color="#FF5C8A"/>
          </linearGradient>
          <linearGradient id="a" x1="13" y1="13" x2="31" y2="31" gradientUnits="userSpaceOnUse">
            <stop stop-color="#6BF5DE"/><stop offset="1" stop-color="#4FF0D4"/>
          </linearGradient>
          <linearGradient id="b" x1="31" y1="13" x2="13" y2="31" gradientUnits="userSpaceOnUse">
            <stop stop-color="#A985FF"/><stop offset="1" stop-color="#6C3BF5"/>
          </linearGradient>
        </defs>
        <rect x="2.6" y="2.6" width="38.8" height="38.8" rx="13" fill="none" stroke="url(#f)" stroke-width="1.7"/>
        <path d="M14.5 14.5 29.5 29.5" stroke="url(#a)" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M29.5 14.5 14.5 29.5" stroke="url(#b)" stroke-width="3.4" stroke-linecap="round"/>
        <circle cx="22" cy="22" r="3.1" fill="#04050A"/><circle cx="22" cy="22" r="1.5" fill="#4FF0D4"/>
      </svg>
      <span>Smart<span class="fx">Fixx</span></span>
    </div>

    <h1>On conçoit, on refond,<br><span class="grad">on automatise.</span></h1>
    <p>Sites web sur-mesure et automatisation informatique. Si une tâche revient chaque semaine, elle peut disparaître.</p>

    <div class="tags">
      <div class="tag">Création de site web</div>
      <div class="tag">Refonte complète</div>
      <div class="tag">Automatisation</div>
    </div>
  </div>

  <div class="rule"></div>
</body></html>`;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await tab.setContent(await page(), { waitUntil: "load" });
await tab.evaluate(() => document.fonts.ready);
await writeFile(OUT, await tab.screenshot({ type: "png" }));
await browser.close();

console.log(`✓ ${OUT}`);
