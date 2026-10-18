import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Publish only assets actually referenced by the production entry, never all of
// public/: that directory may also contain private, untracked working paintings.
// The standalone packager reads the original dist; this creates a separate site.
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const args = process.argv.slice(2);
let base = '/hwh/', output = path.join(root, 'release', 'web', 'hwh');
for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--base' && args[i + 1]) base = args[i + 1];
  else if (args[i] === '--out' && args[i + 1]) output = path.resolve(args[i + 1]);
  else throw new Error('Usage: node scripts/package-web.mjs [--base /hwh/] [--out release/web/hwh]');
}
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('The website base must be an absolute directory path.');
if (!output.startsWith(path.join(root, 'release') + path.sep)) throw new Error('Stage the website inside release before publishing.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const records = new Map();
const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
const originalHTML = await readFile(path.join(dist, 'index.html'), 'utf8');
const entry = [...originalHTML.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])[^"']+\1[^>]*>\s*<\/script\s*>/gi)];
if (entry.length !== 1) throw new Error('Expected a single production script.');

async function emit(file, bytes) {
  const destination = path.resolve(output, file);
  if (!destination.startsWith(output + path.sep)) throw new Error('Website output escaped its directory.');
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  records.set(file, { file, bytes: Buffer.byteLength(bytes), sha256: hash(bytes), url: base + file });
}
async function asset(assetPath) {
  if (!/^\/(?:art|fonts|audio|films)\//.test(assetPath) && assetPath !== '/favicon.svg') throw new Error('Unexpected website media path.');
  if (/[?#]/.test(assetPath)) throw new Error('Expected a source asset without a query.');
  const file = assetPath.slice(1), source = path.resolve(dist, file);
  if (!source.startsWith(dist + path.sep)) throw new Error('Website asset escaped dist.');
  if (!records.has(file)) await emit(file, await readFile(source));
  // Story text IDs stay stable when a voice changes. Content revisions ensure
  // that an older browser cache cannot replay the previous recording.
  const record = records.get(file);
  record.url = base + file + '?v=' + record.sha256.slice(0, 12);
  return record.url;
}
const jsSource = attribute(entry[0][0], 'src');
if (!jsSource?.startsWith('/assets/')) throw new Error('Expected a local script entry.');
let javascript = await readFile(path.join(dist, jsSource.slice(1)), 'utf8');
if (/\bimport\s*\(/.test(javascript)) throw new Error('The site packager expects no lazy JavaScript modules.');
const jsLiteral = /(["'`])(\/(?:art|fonts|audio|films)\/[^"'`\\\r\n]+)\1/g;
const media = [...new Set([...javascript.matchAll(jsLiteral)].map(m => m[2]))];
const urls = new Map();
for (const source of media) urls.set(source, await asset(source));
javascript = javascript.replace(jsLiteral, (_literal, quote, source) => quote + urls.get(source) + quote);
const jsFile = 'assets/index-' + hash(javascript).slice(0, 12) + '.js';
await emit(jsFile, javascript);
let html = originalHTML.replace(jsSource, base + jsFile);
for (const tag of [...originalHTML.matchAll(/<link\b[^>]*>/gi)].map(m => m[0])) {
  const rel = attribute(tag, 'rel'), href = attribute(tag, 'href');
  if (rel === 'stylesheet') {
    if (!href?.startsWith('/assets/')) throw new Error('Expected a local stylesheet.');
    let css = await readFile(path.join(dist, href.slice(1)), 'utf8');
    const cssURL = /url\(\s*(["']?)(\/(?:art|fonts|audio|films)\/[^)"']+)\1\s*\)/gi;
    for (const source of [...new Set([...css.matchAll(cssURL)].map(m => m[2].trim()))]) urls.set(source, await asset(source));
    css = css.replace(cssURL, (_url, _quote, source) => 'url("' + urls.get(source.trim()) + '")');
    const cssFile = 'assets/index-' + hash(css).slice(0, 12) + '.css';
    await emit(cssFile, css); html = html.replace(href, base + cssFile);
  } else if (rel?.includes('icon')) html = html.replace(href, await asset(href));
}
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
html = html.replace('</head>', `<!-- Next Spring ${version}: scene media and recorded narration load on demand. -->\n</head>`);
await emit('index.html', html);
records.get('index.html').url = base + '?v=' + version;
const report = { version, base, entryBytes: Buffer.byteLength(html), files: [...records.values()],
  totalBytes: [...records.values()].reduce((sum, item) => sum + item.bytes, 0),
  excludesUnreferencedSources: true };
await writeFile(path.join(root, 'release', 'web-build-v' + version + '.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ directory: output, files: records.size, entryBytes: report.entryBytes, totalBytes: report.totalBytes }));
