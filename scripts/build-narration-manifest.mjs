import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { isDeepStrictEqual } from 'node:util';
import { collectNarrationInventory } from './list-narration.mjs';
import { normalizeNarrationText } from '../src/recordedNarration.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : isObject(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;

export function validateNarrationInventory(inventory, current = collectNarrationInventory()) {
  if (!isDeepStrictEqual(inventory, current)) fail('Narration inventory does not match the current story. Regenerate it before building.');
  if (inventory.unrecordable.length) fail('Narration inventory still contains dynamic player-name text.');
  if (!inventory.clips.length || inventory.stats.recordableClips !== inventory.clips.length
    || inventory.stats.playbackBindings !== inventory.entries.length) fail('Narration inventory counts are invalid.');
  const ids = new Set();
  for (const clip of inventory.clips) {
    if (!validHash(clip.id) || ids.has(clip.id) || clip.textHash !== clip.id
      || hash(normalizeNarrationText(clip.text)) !== clip.id) fail('Narration inventory text hash is invalid.');
    ids.add(clip.id);
  }
  return inventory;
}

export function validateRecordingMetadata(metadata, expected, bytes) {
  if (!isObject(metadata) || !validHash(metadata.id) || metadata.id !== expected.id
    || metadata.text !== expected.text || metadata.textHash !== expected.textHash
    || metadata.textHash !== hash(normalizeNarrationText(metadata.text))) {
    fail(`Recording text or ID mismatch: ${expected.id}`);
  }
  if (!Number.isSafeInteger(metadata.bytes) || metadata.bytes <= 0 || metadata.bytes !== bytes.length
    || !validHash(metadata.sha256) || metadata.sha256 !== hash(bytes)) {
    fail(`Recording audio size or SHA-256 mismatch: ${expected.id}`);
  }
  if (!Number.isFinite(metadata.seconds) || metadata.seconds <= 0
    || !Number.isInteger(metadata.sampleRate) || metadata.sampleRate < 8000 || metadata.sampleRate > 96000
    || typeof metadata.model !== 'string' || !metadata.model.trim()
    || metadata.license !== 'Apache-2.0' || metadata.synthetic !== true
    || !validHash(metadata.modelArchiveSha256) || !validHash(metadata.voiceConfigHash) || !isObject(metadata.voiceConfig)
    || !Number.isInteger(metadata.sid) || metadata.sid < 0
    || !Number.isFinite(metadata.speed) || metadata.speed <= 0 || metadata.speed > 3) {
    fail(`Recording format or provenance is invalid: ${expected.id}`);
  }
  if (['model', 'modelArchiveSha256', 'sid', 'speed', 'sampleRate'].some((key) => metadata.voiceConfig[key] !== metadata[key])
    || metadata.voiceConfig.channels !== 1 || metadata.voiceConfig.codec !== 'libmp3lame'
    || hash(JSON.stringify(canonical(metadata.voiceConfig))) !== metadata.voiceConfigHash) {
    fail(`Recording voice configuration hash or settings mismatch: ${expected.id}`);
  }
  return metadata;
}

async function readJSON(file) {
  let metadata;
  try {
    metadata = await lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 5_000_000) fail('Not a regular JSON file');
    return JSON.parse(await readFile(file, 'utf8'));
  } catch { fail(`Required recording metadata is missing or invalid: ${path.basename(file)}`); }
}

export async function probeNarrationAudio(file) {
  let result;
  try {
    result = await run('ffprobe', ['-v', 'error', '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels', '-show_entries', 'format=duration',
      '-of', 'json', file], { timeout: 15000, maxBuffer: 100000 });
  } catch { fail(`Recording could not be decoded: ${path.basename(file)}`); }
  let probe;
  try { probe = JSON.parse(result.stdout); } catch { fail('ffprobe returned invalid metadata.'); }
  const stream = probe.streams?.[0];
  const seconds = Number(probe.format?.duration);
  if (stream?.codec_name !== 'mp3' || stream.channels !== 1
    || !Number.isFinite(seconds) || seconds <= 0 || !Number.isInteger(Number(stream.sample_rate))) {
    fail(`Recording must be a valid mono MP3: ${path.basename(file)}`);
  }
  try {
    const decoded = await run('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-threads', '1', '-i', file, '-f', 'null', '-'],
      { timeout: 30000, maxBuffer: 100000 });
    if (decoded.stderr.trim()) fail('The decoder reported an audio error.');
  } catch { fail(`Recording failed complete MP3 decoding: ${path.basename(file)}`); }
  return { seconds, sampleRate: Number(stream.sample_rate), channels: stream.channels, codec: stream.codec_name };
}

function provenance(metadata) {
  return Object.fromEntries(['model', 'license', 'licenseUrl', 'synthetic', 'sid', 'speed', 'sampleRate', 'voiceConfig',
    'voiceConfigHash', 'modelArchiveSha256'].filter((key) => metadata[key] !== undefined)
    .map((key) => [key, metadata[key]]));
}

export async function prepareNarrationManifest({ inventoryPath, recordingsDir, voiceName = '春语 · 温柔女声',
  currentInventory = collectNarrationInventory(), probe = probeNarrationAudio } = {}) {
  if (typeof voiceName !== 'string' || !voiceName.trim() || voiceName.length > 100) fail('A valid voice name is required.');
  const inventory = validateNarrationInventory(await readJSON(inventoryPath), currentInventory);
  const results = await readJSON(path.join(recordingsDir, 'results.json'));
  if (results.complete !== true || !Array.isArray(results.clips) || results.clips.length !== inventory.clips.length
    || results.stats?.clips !== inventory.clips.length) fail('The recording batch is not complete.');
  if (results.inventorySha256 !== hash(await readFile(inventoryPath))) fail('Recording batch was generated from a different inventory file.');
  const completed = new Map(results.clips.map((clip) => [clip?.id, clip]));
  if (completed.size !== inventory.clips.length) fail('The recording results contain duplicate or missing clip IDs.');
  const files = [];
  const clips = [];
  let batchProvenance;
  for (const expected of inventory.clips) {
    const source = path.join(recordingsDir, `${expected.id}.mp3`);
    const metadata = await readJSON(path.join(recordingsDir, `${expected.id}.json`));
    if (!isDeepStrictEqual(completed.get(expected.id), metadata)) fail(`Recording metadata differs from results.json: ${expected.id}`);
    let bytes;
    try {
      const file = await lstat(source);
      if (!file.isFile() || file.isSymbolicLink()) fail('Not a regular recording file');
      bytes = await readFile(source);
    } catch { fail(`Required recording is missing: ${expected.id}.mp3`); }
    validateRecordingMetadata(metadata, expected, bytes);
    const properties = await probe(source);
    if (properties.sampleRate !== metadata.sampleRate || Math.abs(properties.seconds - metadata.seconds) > 0.02) {
      fail(`Recording duration or sample rate mismatch: ${expected.id}`);
    }
    const origin = provenance(metadata);
    if (!batchProvenance) batchProvenance = origin;
    else if (!isDeepStrictEqual(batchProvenance, origin)) fail('Recording batch mixes incompatible voice configurations.');
    files.push({ source, id: expected.id, sha256: metadata.sha256, bytes: metadata.bytes });
    clips.push({
      ...expected,
      src: `/audio/narration/${expected.id}.mp3`,
      sha256: metadata.sha256, seconds: metadata.seconds, durationMs: Math.round(metadata.seconds * 1000),
      sampleRate: metadata.sampleRate, bytes: metadata.bytes,
    });
  }
  for (const key of ['model', 'license', 'sid', 'speed']) {
    if (results[key] !== batchProvenance[key]) fail(`Recording results provenance mismatch: ${key}`);
  }
  for (const key of ['voiceConfig', 'voiceConfigHash', 'modelArchiveSha256']) {
    if (results[key] !== undefined && !isDeepStrictEqual(results[key], batchProvenance[key])) {
      fail(`Recording results provenance mismatch: ${key}`);
    }
  }
  const manifest = {
    version: 1, textNormalization: inventory.textNormalization,
    voice: { id: 'spring-recorded-v1', kind: 'recorded', name: voiceName.trim(), lang: 'zh-CN', localService: true, ...batchProvenance },
    stats: {
      clips: clips.length, bindings: inventory.entries.length,
      seconds: clips.reduce((total, clip) => total + clip.seconds, 0),
      bytes: clips.reduce((total, clip) => total + clip.bytes, 0),
    },
    clips, entries: inventory.entries,
  };
  return { manifest, files };
}

// Preflight validates every recording before touching product files. Audio is
// staged as a complete directory, then the manifest is atomically renamed last.
// If that final commit fails, restore the previous audio directory.
export async function buildNarrationManifest(options = {}) {
  const { manifest, files } = await prepareNarrationManifest(options);
  const destinationRoot = options.destinationRoot ?? root;
  const audioParent = path.join(destinationRoot, 'public', 'audio');
  const audioDestination = path.join(audioParent, 'narration');
  const sourceParent = path.join(destinationRoot, 'src');
  const manifestDestination = path.join(sourceParent, 'narrationClips.js');
  const tag = randomUUID();
  const stage = path.join(audioParent, `.narration-stage-${tag}`);
  const backup = path.join(audioParent, `.narration-backup-${tag}`);
  const temporaryManifest = path.join(sourceParent, `.narrationClips-${tag}.tmp`);
  let backedUp = false;
  let installedAudio = false;
  let committed = false;
  try {
    await mkdir(audioParent, { recursive: true });
    await mkdir(sourceParent, { recursive: true });
    await mkdir(stage);
    for (const file of files) {
      const staged = path.join(stage, `${file.id}.mp3`);
      await copyFile(file.source, staged, constants.COPYFILE_EXCL);
      const bytes = await readFile(staged);
      if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) fail('Recording changed while staging; nothing has been published.');
    }
    await writeFile(temporaryManifest, `// Generated only from a fully verified recording batch.\nexport const NARRATION_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`, { flag: 'wx' });
    try {
      const previous = await lstat(audioDestination);
      if (!previous.isDirectory() || previous.isSymbolicLink()) fail('Existing audio destination is not a regular directory.');
      await rename(audioDestination, backup);
      backedUp = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(stage, audioDestination);
    installedAudio = true;
    await rename(temporaryManifest, manifestDestination);
    committed = true;
  } finally {
    if (!committed && installedAudio) await rm(audioDestination, { recursive: true, force: true });
    if (!committed && backedUp) await rename(backup, audioDestination);
    await rm(stage, { recursive: true, force: true });
    await rm(temporaryManifest, { force: true });
    if (committed && backedUp) await rm(backup, { recursive: true, force: true });
  }
  return { manifest, manifestPath: manifestDestination, audioDirectory: audioDestination };
}

export async function main(args = process.argv.slice(2)) {
  const options = {};
  const names = { '--inventory': 'inventoryPath', '--recordings': 'recordingsDir', '--voice-name': 'voiceName' };
  for (let index = 0; index < args.length; index += 2) {
    const key = names[args[index]];
    if (!key || !args[index + 1] || options[key] !== undefined) fail('Usage: node scripts/build-narration-manifest.mjs --inventory <inventory.json> --recordings <directory> --voice-name <name>');
    options[key] = key === 'voiceName' ? args[index + 1] : path.resolve(args[index + 1]);
  }
  if (!options.inventoryPath || !options.recordingsDir) fail('Both --inventory and --recordings are required.');
  const relative = path.relative(root, options.inventoryPath);
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    try { await run('git', ['check-ignore', '--quiet', '--', relative], { cwd: root }); }
    catch { fail('The inventory file inside the repository must be gitignored.'); }
  }
  const result = await buildNarrationManifest(options);
  console.log(JSON.stringify({ manifest: result.manifestPath, audioDirectory: result.audioDirectory, ...result.manifest.stats }));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
