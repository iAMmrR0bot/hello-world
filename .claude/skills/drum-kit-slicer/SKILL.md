---
name: drum-kit-slicer
description: Turn a drum stem (WAV/FLAC) into a curated, labelled, ordered one-shot kit plus MIDI loops of each song section, saved where Maschine/Battery can browse it. Use when the user drops a drum stem and names the song.
---

# Drum stem → Maschine/Battery kit

The user drops a drum stem (usually a lalal.ai drum split) and gives a song name. Output: a folder of clean one-shots, named and ordered, plus one MIDI loop per section of the song that plays those samples, saved in the kit library. One pass, no hand-holding.

## Settings (edit once)
- KIT_ROOT: `~/Music/Drum Kits`  ← the user added this folder in Maschine (Preferences → Library → User → Add) and browses it in Battery's Files tab. If it doesn't exist yet, create it and tell the user to add it once.
- Script: `slice_kit.py` in this skill folder.
- Deps: `librosa soundfile matplotlib scikit-learn numpy scipy mido`. If missing, install into `~/.venvs/drumkit` (`python3 -m venv` then pip) and run the script with that python.

## Inputs
- Stem path, and the song name. If the song name isn't given, take it from the filename (e.g. `Alex_Warren_-_EMERALD_EYES_..._drum_split` → `emerald_eyes`). Prefix = lowercase snake_case song title, no artist.
- Kit folder: `KIT_ROOT/<Song Title> Kit/` (e.g. `Emerald Eyes Kit`). If it already exists with WAVs, ask before overwriting.

## The user's rules (non-negotiable)
- **Full but compact.** Aim for about 10–16 samples total: 2–3 per main sound (kick, snare, hat) when the song has real variations (fill hits, intro vs. groove, brighter/darker, harder/softer), 1–2 for everything else (open hat, crash, perc, toms). Don't go past ~16, and never export every hit.
- **Usable beats perfect.** Prefer clean, isolated hits, but don't skip a sound just because every example has a little bleed. If the drum comes through clearly, include it and note the bleed in the report. Only skip a sound when it's buried.
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
3. Pick the cleanest hit for each sound. Prefer: long `gap` (full tail), low `pre_ratio` (nothing ringing into it), low `hi_bleed` for kicks/snares/toms (no cymbal or hat on top), low `low_bleed` for hats/perc (no kick underneath). Look at the candidate image before you trust the numbers. Avoid a kick with a heavy crash wash over it when a cleaner one exists.
4. Write `picks.json`: `[{"name":"kick","hit":173,"groups":[2,8]}, ...]`. Optional `"max_len": seconds` per pick.
   `groups` = the analysis groups that ARE this sound across the song (from step 2). The MIDI loops use it to decide which pad every hit in the song plays, so label every real drum group: a group can sit under several variants of the same sound (the closest-sounding variant wins per hit), and a group that's kick+hat together goes under the kick. Leave out bleed/noise groups. A pick without `groups` only plays at its own hit.
5. `python slice_kit.py export <stem> <workdir> picks.json "<KIT_ROOT>/<Song> Kit" --song <prefix>`.
   Export also writes the MIDI: `<song>_loop_A.mid`, `_B`… (4 bars each, one per distinct section pattern, human timing kept, velocity from how hard each hit was played, pad 01 = C1/36, 02 = C#1…) and `<song>_loops.txt` saying where each loop plays in the song. It prints the detected BPM and how tightly the hits lock to the grid; if it says "loose", tell the user the loops are approximate.
6. Look at `kit_sheet.png`. Re-pick anything with obvious bleed or a clipped attack, and re-export with `--force`.
7. Report back tersely: the folder path, BPM, a table (file, source time, one-line note), the loops (letter, how often it plays, where), and honest compromises (e.g. "kicks only ~220 ms, an 8th-note grid with no gaps", "toms have kick underneath"). Then remind the user to hit Rescan in Maschine's User library if the kit doesn't show up.

Never delete the stem. Keep the workdir only until the kit is confirmed.
