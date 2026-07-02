# CLAUDE.md

Fork of wiedehopf/tar1090 (origin: `github.com:timFinn/tar1090` — GitHub, not Forgejo; `upstream` remote points at wiedehopf). Custom work is the **weather radar overlay** (RainViewer animated + IEM static hi-res, WMS TIME historical frames, extended history/playback).

- **This fork is deployment-relevant**: sdr-pi's `adsb` role clones `https://github.com/timFinn/tar1090.git` (`tar1090_repo` in `ansible/roles/adsb/defaults/main.yml`) — pushing here changes what new SDR Pi builds get.
- `../tar1090` is an older checkout of the same fork (no upstream remote) — work here, not there.
- To pull upstream changes: `git fetch upstream && git merge upstream/master`.
