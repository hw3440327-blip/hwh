import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes } from '../src/story.js';
import { origins } from '../src/origins.js';
import { availableChoices, choose, createGame, getSceneParagraphs } from '../src/engine.js';
import { sceneArtKey, sceneDetails } from '../src/visuals.js';
import { NARRATION_PREVIEW } from '../src/narration.js';
import { RECORDED_PREVIEW_KEY, normalizeNarrationText } from '../src/recordedNarration.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const textHash = (text) => createHash('sha256').update(normalizeNarrationText(text), 'utf8').digest('hex');
const characters = (text) => Array.from(text).length;
const han = (text) => (text.match(/\p{Script=Han}/gu) || []).length;

export function collectNarrationInventory() {
  const relevantFlags = new Set(Object.values(scenes).flatMap((scene) => [
    ...scene.choices.map((choice) => choice.condition),
    ...(scene.paragraphVariants ?? []).map((variant) => variant.condition),
  ].flatMap((condition) => [condition?.flag, condition?.notFlag].filter(Boolean))));
  const reached = [];
  for (const origin of origins) {
    const queue = [createGame('旅人', origin.id)];
    const seen = new Set();
    for (let index = 0; index < queue.length; index += 1) {
      const game = queue[index];
      const key = `${game.sceneId}:${game.flags.filter((flag) => relevantFlags.has(flag)).sort().join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 10000) throw new Error('Narration traversal exceeded its finite story limit.');
      reached.push(game);
      for (const choice of availableChoices(game)) queue.push(choose(game, choice.id));
    }
  }
  const clips = new Map();
  const entries = [];
  const unrecordable = [];
  const scenesSummary = [];
  const addClip = (text, kind) => {
    const normalized = normalizeNarrationText(text);
    const hash = textHash(normalized);
    if (!clips.has(hash)) clips.set(hash, {
      id: hash, textHash: hash, text: normalized, kind,
      characters: characters(normalized), han: han(normalized),
    });
    return hash;
  };
  const addEntry = ({ key, text, segments, ...context }) => {
    const normalized = normalizeNarrationText(text);
    if (segments.map((segment) => normalizeNarrationText(segment.text)).join('') !== normalized) {
      throw new Error(`Narration segments do not exactly match ${key}`);
    }
    if (/\{name\}/.test(normalized)) {
      unrecordable.push({ key, template: normalized, reason: 'dynamic-player-name', ...context });
      return;
    }
    entries.push({
      key, text: normalized, textHash: textHash(normalized),
      clipIds: segments.map((segment) => addClip(segment.text, segment.kind)), ...context,
    });
  };

  for (const scene of Object.values(scenes)) {
    const paragraphs = scene.paragraphs.map(() => new Map());
    for (const game of reached.filter((candidate) => candidate.sceneId === scene.id)) {
      getSceneParagraphs(game).forEach((text, index) => {
        const normalized = normalizeNarrationText(text);
        if (!paragraphs[index].has(normalized)) paragraphs[index].set(normalized, { origins: new Set(), routes: new Set() });
        const context = paragraphs[index].get(normalized);
        context.origins.add(game.origin);
        game.flags.filter((flag) => flag.startsWith('route_')).forEach((flag) => context.routes.add(flag));
      });
    }
    if (paragraphs.some((versions) => versions.size === 0)) throw new Error(`Unreachable scene paragraph: ${scene.id}`);
    for (let index = 0; index < paragraphs.length; index += 1) {
      for (const [text, context] of paragraphs[index]) addEntry({
        key: `story:${scene.id}:${index}`, text, segments: [{ text, kind: 'story' }],
        sceneId: scene.id, paragraphIndex: index,
        origins: [...context.origins].sort(), routes: [...context.routes].sort(),
      });
    }
    scenesSummary.push({
      sceneId: scene.id, paragraphs: scene.paragraphs.length,
      variantsPerParagraph: paragraphs.map((versions) => versions.size),
      totalVersions: paragraphs.reduce((total, versions) => total + versions.size, 0),
    });
  }

  for (const scene of Object.values(scenes)) {
    for (const detail of sceneDetails(scene)) {
      const body = `${detail.label}。${detail.text}`;
      addEntry({
        key: `detail:${scene.id}:${detail.id}`, text: `${body}${detail.connection}`,
        segments: [{ text: body, kind: 'detail-base' }, { text: detail.connection, kind: 'scene-connection' }],
        sceneId: scene.id, detailId: detail.id, artKey: sceneArtKey(scene),
      });
    }
  }
  addEntry({ key: RECORDED_PREVIEW_KEY, text: NARRATION_PREVIEW, segments: [{ text: NARRATION_PREVIEW, kind: 'preview' }] });
  const clipList = [...clips.values()];
  const byKind = Object.fromEntries(['story', 'detail-base', 'scene-connection', 'preview'].map((kind) => {
    const group = clipList.filter((clip) => clip.kind === kind);
    return [kind, { clips: group.length, characters: group.reduce((sum, clip) => sum + clip.characters, 0), han: group.reduce((sum, clip) => sum + clip.han, 0) }];
  }));
  return {
    version: 1,
    textNormalization: 'NFC-and-LF-only',
    stats: {
      scenes: scenesSummary.length,
      baseParagraphs: scenesSummary.reduce((total, scene) => total + scene.paragraphs, 0),
      storyVersions: scenesSummary.reduce((total, scene) => total + scene.totalVersions, 0),
      reachableContexts: reached.length,
      recordableClips: clipList.length,
      playbackBindings: entries.length,
      unrecordableTemplates: unrecordable.length,
      characters: clipList.reduce((sum, clip) => sum + clip.characters, 0),
      han: clipList.reduce((sum, clip) => sum + clip.han, 0), byKind,
    },
    scenes: scenesSummary, clips: clipList, entries, unrecordable,
  };
}

function assertIgnoredOutput(destination) {
  const relative = path.relative(root, destination);
  if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return;
  try { execFileSync('git', ['check-ignore', '--quiet', '--', relative], { cwd: root, stdio: 'ignore' }); }
  catch { throw new Error('Output inside the repository must be gitignored (for example release/narration-inventory.json).'); }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--output') {
    throw new Error('Usage: node scripts/list-narration.mjs --output /tmp/narration-inventory.json');
  }
  const destination = path.resolve(args[1]);
  assertIgnoredOutput(destination);
  const inventory = collectNarrationInventory();
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: destination, ...inventory.stats }));
  return inventory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
