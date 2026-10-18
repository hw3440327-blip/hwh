import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build first with `npm run build`, then run this script from any directory.
// Only the existing, local production build is read; no network is needed.
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');
const destination = path.join(root, 'release', '下一次春天-电影生活版.html');
const requiredAssets = [
  '/art/film-arrival.webp', '/art/film-bakery.webp', '/art/film-bookshop.webp', '/art/film-workshop.webp',
  '/art/film-kitchen.webp', '/art/film-garden.webp', '/art/film-shore.webp', '/art/film-night.webp',
  '/art/immersive-room.webp', '/art/immersive-letters.webp', '/art/immersive-community.webp',
  '/art/immersive-market.webp', '/art/immersive-courtyard.webp', '/art/immersive-winter-courtyard.webp',
  '/art/play-tea-table.webp', '/art/play-tea-pot.webp', '/art/play-tea-cup.webp', '/art/play-shell-shore.webp',
  '/audio/ambience/sea.ogg', '/audio/ambience/rain.ogg', '/audio/ambience/garden.ogg',
  '/audio/ambience/interior.ogg', '/audio/ambience/bakery.ogg', '/audio/ambience/workshop.ogg',
  '/audio/ambience/touch.ogg', '/audio/ambience/wood.ogg', '/audio/ambience/page.ogg',
  '/audio/ambience/water.ogg', '/audio/ambience/pour.ogg', '/audio/ambience/complete.ogg',
  '/fonts/spring-serif.woff', '/favicon.svg',
];
const mimeTypes = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.avif': 'image/avif', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ogg': 'audio/ogg',
};
const dataURLs = new Map();

function localAsset(asset) {
  if (!asset.startsWith('/') || asset.startsWith('//') || /[?#]/.test(asset)) {
    throw new Error(`Expected a local build asset: ${asset}`);
  }
  const location = path.resolve(dist, `.${asset}`);
  if (!location.startsWith(`${dist}${path.sep}`)) throw new Error('Asset escaped the build directory.');
  return location;
}

async function asDataURL(asset) {
  if (!dataURLs.has(asset)) {
    const mime = mimeTypes[path.extname(asset).toLowerCase()];
    if (!mime) throw new Error(`Unsupported offline asset type: ${asset}`);
    dataURLs.set(asset, `data:${mime};base64,${(await readFile(localAsset(asset))).toString('base64')}`);
  }
  return dataURLs.get(asset);
}

function attribute(tag, name) {
  return tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
}

function withoutSourceMaps(source) {
  return source
    .replace(/^\s*\/\/[#@]\s*sourceMappingURL=.*$/gm, '')
    .replace(/\/\*[#@]\s*sourceMappingURL=[\s\S]*?\*\//g, '');
}

await access(path.join(dist, 'index.html'));
await Promise.all(requiredAssets.map(asset => access(localAsset(asset))));
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!/<!doctype\s+html\s*>/i.test(html) || !/<meta\s+charset=["']UTF-8["']/i.test(html) || !/<meta\s+name=["']viewport["']/i.test(html)) {
  throw new Error('The build must contain an HTML doctype, UTF-8 charset, and viewport metadata.');
}

const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])[^"']+\1[^>]*>\s*<\/script\s*>/gi)];
if (scriptTags.length !== 1) throw new Error('Expected one self-contained production JavaScript entry.');
const scriptTag = scriptTags[0][0];
let javascript = withoutSourceMaps(await readFile(localAsset(attribute(scriptTag, 'src')), 'utf8'));
if (/\bimport\s*\(/.test(javascript) || /(?:^|[;\n])\s*(?:import\s+(?:["'{*]|[\w$]+\s+from)|export\s+[^;]*\s+from\s*["'])/m.test(javascript)) {
  throw new Error('The production JavaScript entry must not require additional modules.');
}

// Store each illustration only once, even when several scenes share it.
// Replacing complete string literals preserves the original game behavior.
const jsAssetLiteral = /(["'`])(\/(?:art|fonts|audio|films)\/[^"'`\\\r\n]+)\1/g;
const jsAssets = [...new Set([...javascript.matchAll(jsAssetLiteral)].map(match => match[2]))];
const jsIdentifiers = new Map(jsAssets.map((asset, index) => [asset, `__nextSpringOfflineAsset_${index}`]));
for (const identifier of jsIdentifiers.values()) {
  if (javascript.includes(identifier)) throw new Error('An offline asset identifier already exists in the build.');
}
const assetDeclarations = [];
for (const asset of jsAssets) assetDeclarations.push(`const ${jsIdentifiers.get(asset)}=${JSON.stringify(await asDataURL(asset))};`);
javascript = javascript.replace(jsAssetLiteral, (_literal, _quote, asset) => jsIdentifiers.get(asset));
if (/\/(?:art|fonts|audio|films)\//.test(javascript)) {
  throw new Error('A runtime asset path could not be converted to an offline URL.');
}
javascript = `${assetDeclarations.join('\n')}\n${javascript}`;
// HTML parses script closing tags even inside JS strings and comments.
javascript = javascript.replace(/<\/script/gi, '<\\/script');
html = html.replace(scriptTag, () => `<script type="module">\n${javascript}\n</script>`);

const stylesheetTags = [...html.matchAll(/<link\b[^>]*>/gi)]
  .map(match => match[0])
  .filter(tag => attribute(tag, 'rel') === 'stylesheet');
if (!stylesheetTags.length) throw new Error('The production build has no stylesheet.');
for (const tag of stylesheetTags) {
  let css = withoutSourceMaps(await readFile(localAsset(attribute(tag, 'href')), 'utf8'));
  const cssURL = /url\(\s*(["']?)(\/(?:art|fonts|audio|films)\/[^)"']+)\1\s*\)/gi;
  const cssAssets = [...new Set([...css.matchAll(cssURL)].map(match => match[2].trim()))];
  for (const asset of cssAssets) await asDataURL(asset);
  css = css.replace(cssURL, (_url, _quote, asset) => `url("${dataURLs.get(asset.trim())}")`);
  if (/\/(?:art|fonts|audio|films)\//.test(css) || /@import\b/i.test(css)) {
    throw new Error('A stylesheet still requires another local or remote resource.');
  }
  css = css.replace(/<\/style/gi, '<\\/style');
  html = html.replace(tag, () => `<style>\n${css}\n</style>`);
}

const iconTags = [...html.matchAll(/<link\b[^>]*>/gi)]
  .map(match => match[0])
  .filter(tag => /(?:^|\s)icon(?:\s|$)/.test(attribute(tag, 'rel') || ''));
for (const tag of iconTags) {
  const href = attribute(tag, 'href');
  const data = await asDataURL(href);
  const inlineTag = tag
    .replace(href, () => data)
    .replace(/\s+crossorigin(?:\s*=\s*(?:["'][^"']*["']|[^\s>]+))?/gi, '');
  html = html.replace(tag, () => inlineTag);
}

html = html.replace('</head>', `<!-- Next Spring: Cinematic Life Edition ${version}. Original music is synthesized locally. Primary Chinese narration is prerecorded neural audio embedded locally; optional system voices depend on device services. Spring Serif is a subset of Noto Serif SC, licensed under the SIL Open Font License 1.1; see the accompanying OFL-Noto.txt. -->\n  </head>`);
if (/(?:src|href)\s*=\s*["']\/(?:assets|art|fonts|audio|films)\//i.test(html) || /<link\b[^>]*rel=["']modulepreload["']/i.test(html)) {
  throw new Error('The HTML still requires a production asset request.');
}
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, html, 'utf8');
console.log(`${destination} (${Buffer.byteLength(html).toLocaleString('en-US')} bytes)`);
