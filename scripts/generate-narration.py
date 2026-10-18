#!/usr/bin/env python3
"""Render an exact narration inventory with a locally provisioned Kokoro model.

No models or Python packages are downloaded. Outputs and source WAVs belong in an
ignored build directory. Each cached clip must match its text, complete voice
configuration, and audio checksum before it can be reused.
"""

import argparse
import concurrent.futures
import hashlib
import json
import math
import multiprocessing
import os
from pathlib import Path
import subprocess
import sys
import time


MODEL_NAME = "Kokoro-82M-v1.1-zh"
MODEL_ARCHIVE_SHA256 = "a3f4c73d043860e3fd2e5b06f36795eb81de0fc8e8de6df703245edddd87dbad"
LICENSE_URL = "https://raw.githubusercontent.com/hexgrad/kokoro/main/LICENSE"
_worker = {}


def sha256_file(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def canonical_hash(value):
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def write_json(path, value):
    path = Path(path)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def run(command, **kwargs):
    return subprocess.run(command, check=True, capture_output=True, **kwargs)


def probe(path, ffprobe):
    info = json.loads(run([
        ffprobe, "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", str(path),
    ]).stdout)
    streams = info.get("streams", [])
    if len(streams) != 1:
        raise ValueError("Expected exactly one audio stream")
    stream = streams[0]
    seconds = float(info["format"]["duration"])
    if stream.get("codec_name") != "mp3" or int(stream["sample_rate"]) != 24000 or stream["channels"] != 1:
        raise ValueError("Expected mono 24 kHz MP3")
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("Invalid audio duration")
    return seconds


def cached_clip(clip, output, voice_hash, ffprobe):
    audio_path = output / (clip["id"] + ".mp3")
    try:
        meta = json.loads((output / (clip["id"] + ".json")).read_text(encoding="utf-8"))
        if any(meta.get(key) != clip[key] for key in ("id", "text", "textHash")):
            return None
        if meta.get("voiceConfigHash") != voice_hash or canonical_hash(meta.get("voiceConfig")) != voice_hash:
            return None
        if meta.get("modelArchiveSha256") != MODEL_ARCHIVE_SHA256:
            return None
        if audio_path.stat().st_size != meta["bytes"] or sha256_file(audio_path) != meta["sha256"]:
            return None
        seconds = probe(audio_path, ffprobe)
        if abs(seconds - float(meta["seconds"])) > 0.0001:
            return None
        return meta
    except (OSError, KeyError, ValueError, TypeError, subprocess.CalledProcessError):
        return None


def initialize_worker(options, voice_config, voice_hash):
    sys.path.insert(0, options["python_packages"])
    import numpy as np
    import sherpa_onnx
    import soundfile as sf

    model = Path(options["model_dir"])
    kokoro = sherpa_onnx.OfflineTtsKokoroModelConfig(
        model=str(model / "model.onnx"), voices=str(model / "voices.bin"),
        tokens=str(model / "tokens.txt"), data_dir=str(model / "espeak-ng-data"),
        lexicon=",".join(str(model / name) for name in ("lexicon-us-en.txt", "lexicon-zh.txt")),
    )
    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(kokoro=kokoro, provider="cpu", num_threads=options["num_threads"]),
        rule_fsts=",".join(str(model / name) for name in ("phone-zh.fst", "date-zh.fst", "number-zh.fst")),
        max_num_sentences=1,
    )
    if not config.validate():
        raise ValueError("Invalid local Kokoro configuration")
    tts = sherpa_onnx.OfflineTts(config)
    if tts.sample_rate != 24000 or not 0 <= options["sid"] < tts.num_speakers:
        raise ValueError("Unsupported sample rate or speaker ID")
    _worker.update(options=options, voice_config=voice_config, voice_hash=voice_hash,
                   np=np, sf=sf, sherpa=sherpa_onnx, tts=tts)


def render_clip(clip):
    options = _worker["options"]
    np, sf = _worker["np"], _worker["sf"]
    output = Path(options["output_dir"])
    stem = clip["id"]
    started = time.perf_counter()
    gen = _worker["sherpa"].GenerationConfig()
    gen.sid, gen.speed, gen.silence_scale = options["sid"], options["speed"], 0.45
    audio = _worker["tts"].generate(clip["text"], gen)
    samples = np.asarray(audio.samples, dtype=np.float32)
    if samples.size == 0 or not np.isfinite(samples).all():
        raise ValueError(f"Empty or non-finite generated audio: {stem}")
    rms = float(np.sqrt(np.mean(samples.astype(np.float64) ** 2)))
    if not math.isfinite(rms) or rms < 0.00001:
        raise ValueError(f"Silent or invalid generated audio: {stem}")
    source_seconds = samples.size / audio.sample_rate
    wav = output / "wav" / (stem + ".wav")
    wav_temporary = wav.with_name(f".{stem}.{os.getpid()}.tmp.wav")
    mp3 = output / (stem + ".mp3")
    mp3_temporary = mp3.with_name(f".{stem}.{os.getpid()}.tmp.mp3")
    try:
        sf.write(str(wav_temporary), samples, audio.sample_rate, subtype="PCM_16")
        run([
            options["ffmpeg"], "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_temporary),
            "-map_metadata", "-1", "-af", "loudnorm=I=-19:TP=-2.5:LRA=7", "-ar", "24000", "-ac", "1",
            "-codec:a", "libmp3lame", "-b:a", "48k", "-id3v2_version", "3", str(mp3_temporary),
        ])
        seconds = probe(mp3_temporary, options["ffprobe"])
        decoded = run([
            options["ffmpeg"], "-hide_banner", "-loglevel", "error", "-i", str(mp3_temporary),
            "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "1", "-ar", "24000", "pipe:1",
        ]).stdout
        decoded = np.frombuffer(decoded, dtype="<f4")
        if decoded.size == 0 or not np.isfinite(decoded).all() or float(np.sqrt(np.mean(decoded ** 2))) < 0.00001:
            raise ValueError(f"Encoded audio is empty, silent, or non-finite: {stem}")
        if abs(decoded.size / 24000 - source_seconds) > 0.1:
            raise ValueError(f"Encoded audio duration does not match source: {stem}")
        meta = {
            "id": stem, "text": clip["text"], "textHash": clip["textHash"],
            "sha256": sha256_file(mp3_temporary), "seconds": round(seconds, 6),
            "sourceSeconds": round(source_seconds, 6), "sampleRate": 24000, "bytes": mp3_temporary.stat().st_size,
            "model": MODEL_NAME, "modelArchiveSha256": MODEL_ARCHIVE_SHA256,
            "license": "Apache-2.0", "licenseUrl": LICENSE_URL, "synthetic": True,
            "sid": options["sid"], "speed": options["speed"], "voiceConfig": _worker["voice_config"],
            "voiceConfigHash": _worker["voice_hash"], "generationSeconds": round(time.perf_counter() - started, 3),
        }
        wav_temporary.replace(wav)
        mp3_temporary.replace(mp3)
        write_json(output / (stem + ".json"), meta)
        return meta
    finally:
        wav_temporary.unlink(missing_ok=True)
        mp3_temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--python-packages", required=True, type=Path)
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--sid", required=True, type=int)
    parser.add_argument("--speed", type=float, default=0.94)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--num-threads", type=int, default=2)
    parser.add_argument("--ffmpeg", default="/usr/bin/ffmpeg")
    parser.add_argument("--ffprobe", default="/usr/bin/ffprobe")
    args = parser.parse_args()
    if args.workers < 1 or args.num_threads < 1 or not math.isfinite(args.speed) or not 0.5 <= args.speed <= 1.5:
        parser.error("Invalid workers, threads, or speed")
    for key in ("model_dir", "python_packages", "inventory", "output_dir"):
        setattr(args, key, getattr(args, key).resolve())
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    if inventory.get("unrecordable"):
        raise ValueError("Inventory contains unrecordable text templates")
    clips = inventory["clips"]
    if not clips or len({clip["id"] for clip in clips}) != len(clips):
        raise ValueError("Inventory must contain unique clips")
    for clip in clips:
        expected = hashlib.sha256(clip["text"].encode("utf-8")).hexdigest()
        if not clip["text"].strip() or clip["id"] != expected or clip["textHash"] != expected:
            raise ValueError("Inventory IDs must equal exact UTF-8 text hashes")
    archive = args.model_dir.parent / (args.model_dir.name + ".tar.bz2")
    if sha256_file(archive) != MODEL_ARCHIVE_SHA256:
        raise ValueError("Model archive does not match the official SHA256")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "wav").mkdir(exist_ok=True)
    voice_config = {
        "model": MODEL_NAME, "modelArchiveSha256": MODEL_ARCHIVE_SHA256,
        "modelFiles": {name: sha256_file(args.model_dir / name) for name in (
            "model.onnx", "voices.bin", "tokens.txt", "lexicon-us-en.txt", "lexicon-zh.txt",
            "phone-zh.fst", "date-zh.fst", "number-zh.fst")},
        "sid": args.sid, "speed": args.speed, "silenceScale": 0.45, "maxNumSentences": 1,
        "provider": "cpu", "numThreads": args.num_threads,
        "sampleRate": 24000, "channels": 1, "codec": "libmp3lame", "bitrate": "48k",
        "loudnorm": {"I": -19, "TP": -2.5, "LRA": 7}, "trimSilence": False,
        "sherpaOnnx": "1.13.8", "pipelineVersion": 1,
    }
    voice_hash = canonical_hash(voice_config)
    started = time.perf_counter()
    records, pending = {}, []
    for clip in clips:
        cached = cached_clip(clip, args.output_dir, voice_hash, args.ffprobe)
        if cached is None:
            pending.append(clip)
        else:
            records[clip["id"]] = cached
    if pending:
        (args.output_dir / "results.json").unlink(missing_ok=True)
    reused = len(records)

    def progress(force=False):
        record = {"count": len(records), "total": len(clips), "reused": reused,
                  "audioSeconds": round(sum(meta["seconds"] for meta in records.values()), 3),
                  "runtimeSeconds": round(time.perf_counter() - started, 2), "sid": args.sid,
                  "voiceConfigHash": voice_hash}
        write_json(args.output_dir / "progress.json", record)
        if force or len(records) % 10 == 0 or len(records) == len(clips):
            print("PROGRESS " + json.dumps(record, sort_keys=True), flush=True)

    progress(True)
    options = {key: str(value) if isinstance(value, Path) else value for key, value in vars(args).items()}
    if pending:
        with concurrent.futures.ProcessPoolExecutor(
            max_workers=args.workers, mp_context=multiprocessing.get_context("spawn"),
            initializer=initialize_worker, initargs=(options, voice_config, voice_hash),
        ) as pool:
            queue = iter(pending)
            running = {pool.submit(render_clip, clip): clip["id"] for clip in [next(queue, None) for _ in range(args.workers)] if clip}
            try:
                while running:
                    done, _ = concurrent.futures.wait(running, return_when=concurrent.futures.FIRST_COMPLETED)
                    for future in done:
                        clip_id = running.pop(future)
                        result = future.result()
                        if result["id"] != clip_id:
                            raise ValueError("Worker returned an unexpected clip")
                        records[clip_id] = result
                        progress()
                        next_clip = next(queue, None)
                        if next_clip is not None:
                            running[pool.submit(render_clip, next_clip)] = next_clip["id"]
            except BaseException:
                for future in running:
                    future.cancel()
                raise
    ordered = [records[clip["id"]] for clip in clips]
    results = {
        "version": 1, "complete": True, "model": MODEL_NAME, "license": "Apache-2.0",
        "licenseUrl": LICENSE_URL, "synthetic": True, "sid": args.sid, "speed": args.speed,
        "inventorySha256": sha256_file(args.inventory), "voiceConfig": voice_config,
        "voiceConfigHash": voice_hash, "stats": {"clips": len(ordered), "reused": reused,
            "audioSeconds": round(sum(meta["seconds"] for meta in ordered), 3),
            "bytes": sum(meta["bytes"] for meta in ordered), "runtimeSeconds": round(time.perf_counter() - started, 3)},
        "clips": ordered,
    }
    write_json(args.output_dir / "results.json", results)
    progress(True)
    print("COMPLETE " + json.dumps(results["stats"], sort_keys=True), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR {type(error).__name__}: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
