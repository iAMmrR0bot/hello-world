---
name: drum-kit-slicer
description: Turn a drum stem (WAV) into a curated, labelled, ordered one-shot kit saved where Maschine/Battery can browse it. Use when the user drops a drum stem and names the song.
---

# Drum stem → Maschine/Battery kit

The user drops a drum stem (usually a lalal.ai drum split) and gives a song name. Output: a folder of clean one-shots, named and ordered, saved in the kit library. One pass, no hand-holding.

## Settings (edit once)
- KIT_ROOT: `~/Music/Drum Kits`  ← the user added this folder in Maschine (Preferences → Library → User → Add) and browses it in Battery's Files tab. If it doesn't exist yet, create it and tell the user to add it once.
- Script: `slice_kit.py` in this skill folder.
- Deps: `librosa soundfile matplotlib scikit-learn numpy`. If missing, install into `~/.venvs/drumkit` (`python3 -m venv` then pip) and run the script with that python.

## Inputs
- Stem path, and the song name. If the song name isn't given, take it from the filename (e.g. `Alex_Warren_-_EMERALD_EYES_..._drum_split` → `emerald_eyes`). Prefix = lowercase snake_case song title, no artist.
- Kit folder: `KIT_ROOT/<Song Title> Kit/` (e.g. `Emerald Eyes Kit`). If it already exists with WAVs, ask before overwriting.

## The user's rules (non-negotiable)
- **Curated, not exhaustive.** Only clean, isolated hits. Never export every hit in the song. Typically 10–20 samples total, 1–3 per category; more only when the variation is real (different drum, pitch, or clearly different velocity/tone).
- **A variation must sound different.** `kick_two` exists only if it differs from `kick`.
- **Natural decay**: each sample runs until the next hit (the script does this), silent tail trimmed. User trims further himself.
- **Original levels**: no normalizing, no processing. Same sample rate/bit depth as the stem.
- **Naming**: `<song>_<category>`, `<song>_<category>_two`, `_three`… Categories: kick, snare, clap, snap, rim, hat, hat_open, shaker, perc, tom (high→low: tom, tom_two, tom_three), crash, ride, sub_hit/808, fx.
- **Order** (script prefixes 01_, 02_…): kicks → snares/claps/snaps/rims → closed hats → open hats → everything else (perc, shaker, toms, cymbals, sub last).

## Process
1. `python slice_kit.py analyze <stem> <workdir>` (workdir = a temp folder, not the kit folder). Read `groups.txt`, look at `overview.png` and every `cands_*.png`.
2. Identify what each group is. Cues:
   - **Kick**: sub/low dominant, lowpeak ~45–65 Hz, little air. Often a second group with extra sub = a kick variation or a kick+808 layer.
   - **Snare**: broadband with a body peak ~140–250 Hz (lowpeak_hz) plus noise to 8k+. A group with snare highs but lowpeak ~50 Hz is snare layered on kick; prefer the pure ones.
   - **Clap/snap**: mostly 1.5–8 kHz, no body, short. **Hats**: centroid 7–11 kHz, tiny peak, on the offbeats; long gap/long high tail = hat_open.
   - **Perc/rim**: pitched mid band (~500 Hz–3 kHz), often in breakdowns or intros. **Toms**: pitched 80–200 Hz bodies in fills, falling pitch = high→low.
   - **Crash**: long high wash (4–16 kHz) after a fill. **Sub/808**: sub only, centroid near 100 Hz.
   - Breakdowns, intros, outros and the hit right before a section gap usually have the cleanest examples. Use `zoom <stem> <workdir> <start> <end>` on fills, breakdowns and anything ambiguous.
3. Pick the cleanest hit for each sound. Prefer: long `gap` (full tail), low `pre_ratio` (nothing ringing into it), low `hi_bleed` for kicks/snares/toms (no cymbal or hat on top), low `low_bleed` for hats/perc (no kick underneath). Look at the candidate image before you trust the numbers. Don't pick a kick that has a crash wash over it.
4. Write `picks.json`: `[{"name":"kick","hit":173}, ...]`. Optional `"max_len": seconds` per pick.
5. `python slice_kit.py export <stem> <workdir> picks.json "<KIT_ROOT>/<Song> Kit" --song <prefix>`.
6. Look at `kit_sheet.png`. Re-pick anything with obvious bleed or a clipped attack, and re-export with `--force`.
7. Report back tersely: the folder path, a table (file, source time, one-line note), and honest compromises (e.g. "kicks only ~220 ms, an 8th-note grid with no gaps", "toms have kick underneath"). Then remind the user to hit Rescan in Maschine's User library if the kit doesn't show up.

Never delete the stem. Keep the workdir only until the kit is confirmed.
