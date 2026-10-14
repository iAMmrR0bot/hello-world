#!/usr/bin/env python3
"""Drum stem -> curated, labelled, ordered sample kit.

  analyze <stem.wav> <workdir>
      Detects every hit, measures it, groups similar hits, scores cleanliness,
      and writes:
        workdir/hits.json        every hit with features + group
        workdir/groups.txt       one line per group with averages + best candidates
        workdir/overview.png     whole-track spectrogram
        workdir/cands_*.png      spectrogram grid of the cleanest candidates per group
        workdir/zoom_<t>.png     (via `zoom`) close-up of any region

  zoom <stem.wav> <workdir> <start_s> <end_s>
      Close-up spectrogram of a region with hit numbers drawn on.

  export <stem.wav> <workdir> <picks.json> <dest_dir>
      picks.json = [{"name":"kick","hit":173}, {"name":"snare","hit":162}, ...]
      Names are category[_two|_three|...]. Writes <song>_<name>.wav files with an
      order prefix (kicks, snares/claps/snaps, hats, then everything else),
      natural decay to the next hit, silent tail trimmed, original level and format,
      plus <song>_index.csv and kit_sheet.png for review.
      Needs --song <song_prefix>.
"""
import sys, os, json, argparse
import numpy as np, soundfile as sf, librosa

HOP = 256
BANDS = {'sub': (20, 120), 'low': (120, 400), 'mid': (400, 2500), 'hi': (2500, 8000), 'air': (8000, 24000)}
ORDER = [('kick',), ('snare', 'rim', 'clap', 'snap'), ('hat', 'hihat', 'shaker'),
         ('perc', 'conga', 'bongo', 'cowbell', 'tamb', 'block'), ('tom',),
         ('crash', 'ride', 'cymbal', 'splash', 'china', 'fx'), ('sub', '808', 'bass')]
NUMS = ['', '_two', '_three', '_four', '_five', '_six', '_seven', '_eight']


def load(path):
    y, sr = sf.read(path, always_2d=True)
    return y, y.mean(1), sr


def lowpeak(m, s, sr):
    seg = m[s + 480:s + 480 + 8192]
    if len(seg) < 1024: return 0.0
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))); f = np.fft.rfftfreq(len(seg), 1 / sr)
    b = (f > 50) & (f < 400)
    return float(f[b][sp[b].argmax()])


def residual(m, s, e, sr, lo, hi):
    """Share of energy in [lo,hi) Hz in the body/tail of a hit (bleed indicator)."""
    seg = m[s + int(.05 * sr):e]
    if len(seg) < 512: seg = m[s:e]
    if len(seg) < 256: return 1.0
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / sr)
    return float(sp[(f >= lo) & (f < hi)].sum() / (sp.sum() + 1e-12))


def analyze(a):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, librosa.display
    from sklearn.cluster import KMeans; from sklearn.preprocessing import StandardScaler
    os.makedirs(a.workdir, exist_ok=True)
    y, m, sr = load(a.stem)
    on = librosa.onset.onset_detect(y=m, sr=sr, hop_length=HOP, backtrack=True, units='samples', delta=0.05)
    S = np.abs(librosa.stft(m, n_fft=2048, hop_length=HOP)); fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
    hits = []
    for i, s in enumerate(on):
        nxt = on[i + 1] if i + 1 < len(on) else len(m)
        seg = S[:, s // HOP:s // HOP + 12]; tot = seg.sum() + 1e-9
        e = {k: float(seg[(fr >= lo) & (fr < hi)].sum() / tot) for k, (lo, hi) in BANDS.items()}
        pre = np.sqrt(np.mean(m[max(0, s - 2400):s] ** 2)); post = np.sqrt(np.mean(m[s:s + 2400] ** 2))
        hits.append(dict(hit=i, t=round(float(s / sr), 3), s=int(s), gap=round(float((nxt - s) / sr), 3),
                         peak=round(float(np.abs(m[s:s + 4800]).max()), 3), pre_ratio=round(float(pre / (post + 1e-9)), 3),
                         cent=round(float((fr[:, None] * seg).sum() / tot)), lowpeak_hz=round(lowpeak(m, s, sr)),
                         hi_bleed=round(residual(m, s, nxt - 96, sr, 5000, 24000), 5),
                         low_bleed=round(residual(m, s, nxt - 96, sr, 20, 300), 5), **{k: round(v, 3) for k, v in e.items()}))
    X = np.array([[h[k] for k in BANDS] + [np.log(h['cent'] + 1), np.log(h['peak'] + 1e-4)] for h in hits])
    k = min(a.groups, len(hits))
    lab = KMeans(k, n_init=20, random_state=0).fit_predict(StandardScaler().fit_transform(X))
    for h, l in zip(hits, lab): h['group'] = int(l)

    def clean_score(h):  # longer room before next hit, quiet before, low bleed
        return min(h['gap'], .6) * 3 - h['pre_ratio'] - 3 * min(h['hi_bleed'], h['low_bleed'])
    lines = []
    groups = sorted(set(lab))
    for g in groups:
        G = [h for h in hits if h['group'] == g]
        best = sorted(G, key=lambda h: -clean_score(h))[:a.per_group]
        avg = {kk: np.mean([h[kk] for h in G]) for kk in list(BANDS) + ['cent', 'peak', 'lowpeak_hz', 'gap']}
        lines.append(f"group {g}: n={len(G)} " + ' '.join(f"{kk}={v:.2f}" if v < 50 else f"{kk}={v:.0f}" for kk, v in avg.items()) +
                     f" | first hits at {[float(h['t']) for h in G[:5]]} | cleanest: " +
                     ', '.join(f"#{h['hit']}@{h['t']}s gap={h['gap']} hiB={h['hi_bleed']} loB={h['low_bleed']}" for h in best))
    json.dump(hits, open(f'{a.workdir}/hits.json', 'w'), indent=0)
    open(f'{a.workdir}/groups.txt', 'w').write('\n'.join(lines) + '\n'); print('\n'.join(lines))

    fig, ax = plt.subplots(2, 1, figsize=(24, 8))
    ax[0].plot(np.arange(len(m)) / sr, m, lw=.3)
    D = librosa.amplitude_to_db(np.abs(librosa.stft(m, n_fft=2048, hop_length=1024)), ref=np.max)
    librosa.display.specshow(D, sr=sr, hop_length=1024, x_axis='time', y_axis='log', ax=ax[1])
    plt.tight_layout(); plt.savefig(f'{a.workdir}/overview.png', dpi=60); plt.close()

    cols = a.per_group
    for p in range(0, len(groups), 5):
        gs = groups[p:p + 5]
        fig, ax = plt.subplots(len(gs), cols, figsize=(5 * cols, 3.2 * len(gs)), squeeze=False)
        for r_, g in enumerate(gs):
            best = sorted([h for h in hits if h['group'] == g], key=lambda h: -clean_score(h))[:cols]
            for c in range(cols):
                axc = ax[r_, c]
                if c >= len(best): axc.axis('off'); continue
                h = best[c]; x = m[max(0, h['s'] - 2400):h['s'] + int(.7 * sr)]
                D = librosa.amplitude_to_db(np.abs(librosa.stft(x, n_fft=1024, hop_length=128)), ref=1.0)
                librosa.display.specshow(D, sr=sr, hop_length=128, y_axis='log', ax=axc, vmin=-60, vmax=30)
                axc.set_title(f"g{g} #{h['hit']} t={h['t']}s gap={h['gap']} lowpk={h['lowpeak_hz']}Hz", fontsize=9)
        plt.tight_layout(); plt.savefig(f'{a.workdir}/cands_{p // 5}.png', dpi=45); plt.close()
    print(f"\n{len(hits)} hits, {len(groups)} groups -> {a.workdir}")


def zoom(a):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, librosa.display
    y, m, sr = load(a.stem); hits = json.load(open(f'{a.workdir}/hits.json'))
    t0, t1 = a.start, a.end; x = m[int(t0 * sr):int(t1 * sr)]
    fig, ax = plt.subplots(figsize=(24, 5))
    D = librosa.amplitude_to_db(np.abs(librosa.stft(x, n_fft=2048, hop_length=128)), ref=np.max)
    librosa.display.specshow(D, sr=sr, hop_length=128, x_axis='time', y_axis='log', ax=ax)
    for h in hits:
        if t0 <= h['t'] < t1:
            ax.axvline(h['t'] - t0, color='c', lw=.6); ax.text(h['t'] - t0, 30, f"#{h['hit']} g{h['group']}", color='w', fontsize=7)
    out = f'{a.workdir}/zoom_{t0:g}-{t1:g}.png'; plt.tight_layout(); plt.savefig(out, dpi=55); print(out)


def order_key(name):
    base = name.split('_')[0].lower()
    for i, grp in enumerate(ORDER):
        if any(base.startswith(g) for g in grp): return i
    return 3  # unknown -> with perc


def export(a):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt, librosa.display
    info = sf.info(a.stem); y, sr = sf.read(a.stem, always_2d=True, dtype='float64')
    hits = {h['hit']: h for h in json.load(open(f'{a.workdir}/hits.json'))}
    picks = json.load(open(a.picks))
    # keep the user's within-category order, sort categories by ORDER
    picks = sorted(enumerate(picks), key=lambda ip: (order_key(ip[1]['name']), ip[0]))
    os.makedirs(a.dest, exist_ok=True)
    if any(f.endswith('.wav') for f in os.listdir(a.dest)) and not a.force:
        sys.exit(f'{a.dest} already has WAVs; pass --force to overwrite')
    rows = ['file,source_time,length_s']; n = len(picks)
    fig, ax = plt.subplots((n + 3) // 4, 4, figsize=(20, 3.5 * ((n + 3) // 4)), squeeze=False)
    for k, (_, p) in enumerate(picks):
        h = hits[p['hit']]; s = max(0, h['s'] - 48); e = min(len(y), h['s'] + int(h['gap'] * sr) - 96)
        if p.get('max_len'): e = min(e, s + int(p['max_len'] * sr))
        seg = y[s:e].copy()
        w = 480; env = np.sqrt(np.convolve((seg ** 2).mean(1), np.ones(w) / w, 'same'))
        idx = np.where(env > env.max() * 10 ** (-45 / 20))[0]
        if len(idx): seg = seg[:min(len(seg), idx[-1] + w)]
        nf = min(480, len(seg) // 4); seg[-nf:] *= np.linspace(1, 0, nf)[:, None]
        fname = f"{k + 1:02d}_{a.song}_{p['name']}.wav"
        sf.write(f'{a.dest}/{fname}', seg, sr, subtype=info.subtype)
        mm, ss = divmod(h['t'], 60); rows.append(f'{fname},{int(mm)}:{ss:05.2f},{len(seg) / sr:.3f}')
        axc = ax.flat[k]
        D = librosa.amplitude_to_db(np.abs(librosa.stft(seg.mean(1), n_fft=1024, hop_length=128)), ref=1.0)
        librosa.display.specshow(D, sr=sr, hop_length=128, y_axis='log', x_axis='time', ax=axc, vmin=-70, vmax=30); axc.set_title(fname, fontsize=9)
    for axc in list(ax.flat)[n:]: axc.axis('off')
    plt.tight_layout(); plt.savefig(f'{a.workdir}/kit_sheet.png', dpi=45); plt.close()
    open(f'{a.dest}/{a.song}_index.csv', 'w').write('\n'.join(rows) + '\n'); print('\n'.join(rows))
    print(f"\nreview sheet: {a.workdir}/kit_sheet.png")


if __name__ == '__main__':
    P = argparse.ArgumentParser(); sp = P.add_subparsers(dest='cmd', required=True)
    p = sp.add_parser('analyze'); p.add_argument('stem'); p.add_argument('workdir'); p.add_argument('--groups', type=int, default=10); p.add_argument('--per-group', type=int, default=4)
    p = sp.add_parser('zoom'); p.add_argument('stem'); p.add_argument('workdir'); p.add_argument('start', type=float); p.add_argument('end', type=float)
    p = sp.add_parser('export'); p.add_argument('stem'); p.add_argument('workdir'); p.add_argument('picks'); p.add_argument('dest'); p.add_argument('--song', required=True); p.add_argument('--force', action='store_true')
    a = P.parse_args(); {'analyze': analyze, 'zoom': zoom, 'export': export}[a.cmd](a)
