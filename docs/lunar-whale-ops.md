# Lunar-Whale Ops Guide

The production host (`lunar-whale`) runs the `errjordan` Phoenix release and a Cloudflare Tunnel. This guide captures the commands and gotchas you need when operating or troubleshooting the box.

## Quick Paths

- App home: `~/apps/errjordan`
- Current release bin (`$BIN`): `~/apps/errjordan/current/bin/errjordan`
- Environment file: `~/apps/errjordan/.env`
- Launchd wrapper scripts: `~/apps/errjordan/bin`
- Cloudflared config: `~/.cloudflared/config.yml`
- GitHub Actions runner: `~/actions-runner`
- LaunchAgent plists: `~/Library/LaunchAgents`
- Logs: `~/apps/errjordan/log/errjordan.{out,err}.log` and `~/Library/Logs/Homebrew/cloudflared.log`

## GitHub Actions Runner

1. Status/start/stop:
   ```bash
   cd ~/actions-runner
   ./svc.sh status
   ./svc.sh start
   ./svc.sh stop
   ```
2. Install as launchd service (one-time):
   ```bash
   ./svc.sh install
   ./svc.sh start
   ```
3. Interactive run (debug):
   ```bash
   cd ~/actions-runner && ./run.sh
   ```
4. Logs: `tail -f ~/actions-runner/_diag/*.log`
5. Recovery:
   - Runner offline → `./svc.sh status`, then `./svc.sh start`
   - Service fails to load → clear quarantine (`xattr -d ...`), ensure exec bits (`chmod +x`), then `launchctl bootout gui/$(id -u)/actions.runner.*` and `launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/actions.runner.jordan-christensen-errjordan.lunar-whale.plist"`
   - Credentials stale → `./config.sh remove`, re-run `./config.sh --url ... --token ... --labels "self-hosted,macos,x64"`, then reinstall service

## Phoenix Environment (`~/apps/errjordan/.env`)

Keep this file at `chmod 600` and source it before manual release commands.

```bash
PHX_SERVER=true
PHX_HOST=errjordan.dev
PORT=4444
SECRET_KEY_BASE=...64-byte-secret...
DATABASE_URL=ecto://USER:PASS@DB_HOST:5432/DB_NAME
RELEASE_DISTRIBUTION=name
RELEASE_NODE=errjordan@127.0.0.1
```

Load it quickly:

```bash
set -a; . "$HOME/apps/errjordan/.env"; set +a
```

## Phoenix Release Lifecycle

Releases land under `~/apps/errjordan/releases/<sha>/errjordan` and `~/apps/errjordan/current` points at the active build.

Key commands:

```bash
"$HOME/apps/errjordan/current/bin/errjordan" start_iex   # interactive console
"$HOME/apps/errjordan/current/bin/errjordan" daemon      # daemonize without launchd
"$BIN" stop                                               # stop current release
"$BIN" pid                                                # get pid
"$BIN" eval 'Ecto.Migrator.with_repo(Errjordan.Repo, &Ecto.Migrator.run(&1, :up, all: true))'

curl -v http://127.0.0.1:4444/
curl -g -v http://[::1]:4444/
lsof -nP -iTCP:4444 -sTCP:LISTEN
```

### Deploy workflow summary

The GitHub Action builds the release, runs migrations, switches the `current` symlink, and restarts the launchd service. The final step waits for `bin/errjordan pid` and dumps launchd status plus release logs if anything fails. When the workflow complains, SSH in, use the launchd instructions below, and review the log output.

## Launchd: Phoenix Release Service

Launchd keeps the release alive after deploys, logouts, and reboots.

### Wrapper script (`~/apps/errjordan/bin/errjordan-launchd.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
APP_HOME="$HOME/apps/errjordan"
ENV_FILE="$APP_HOME/.env"
BIN="$APP_HOME/current/bin/errjordan"
mkdir -p "$APP_HOME/log"

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

# Foreground so launchd supervises it
exec "$BIN" start
```

`chmod 755 ~/apps/errjordan/bin/errjordan-launchd.sh`

### LaunchAgent (`~/Library/LaunchAgents/dev.errjordan.app.plist`)

Create/refresh it with absolute paths using a here-doc so `$HOME` is resolved when the file is written:

```bash
cat <<'EOF' > ~/Library/LaunchAgents/dev.errjordan.app.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>dev.errjordan.app</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>$HOME/apps/errjordan/bin/errjordan-launchd.sh</string>
    </array>
    <key>WorkingDirectory</key><string>$HOME/apps/errjordan</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>$HOME/apps/errjordan/log/errjordan.out.log</string>
    <key>StandardErrorPath</key><string>$HOME/apps/errjordan/log/errjordan.err.log</string>
  </dict>
</plist>
EOF
```

> Launchd does **not** expand `$HOME` inside plists. If you ever see literal `$HOME` in the file, rerun the block above.

### Manage the service (launchctl only)

```bash
launchctl bootout gui/$(id -u)/dev.errjordan.app 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/dev.errjordan.app.plist"
launchctl enable gui/$(id -u)/dev.errjordan.app
launchctl kickstart -k gui/$(id -u)/dev.errjordan.app
```

### Verify status

```bash
launchctl print gui/$(id -u)/dev.errjordan.app | egrep 'state|pid|last exit'
tail -n 50 ~/apps/errjordan/log/errjordan.out.log
tail -n 50 ~/apps/errjordan/log/errjordan.err.log
```

### Manual debug run

```bash
/bin/bash -lc "$HOME/apps/errjordan/bin/errjordan-launchd.sh"
```

Run this when launchd keeps crashing; fix whatever prints, then re-run the launchctl bootstrap/enable/kickstart sequence.

## Cloudflare Tunnel

### Config (`~/.cloudflared/config.yml`)

```
tunnel: <TUNNEL_ID>
credentials-file: /Users/jordanc/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: errjordan.dev
    service: http://[::1]:4444
  - hostname: www.errjordan.dev
    service: http://[::1]:4444
  - service: http_status:404
```

### LaunchAgent (`~/Library/LaunchAgents/homebrew.mxcl.cloudflared.plist`)

Homebrew installs a bare plist that runs `cloudflared` with no arguments and exits immediately. Overwrite it with the working command and log paths:

```bash
cat <<'EOF' > ~/Library/LaunchAgents/homebrew.mxcl.cloudflared.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>KeepAlive</key>
    <dict>
      <key>SuccessfulExit</key><false/>
    </dict>
    <key>Label</key><string>homebrew.mxcl.cloudflared</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/opt/cloudflared/bin/cloudflared</string>
      <string>--config</string>
      <string>/Users/jordanc/.cloudflared/config.yml</string>
      <string>--no-autoupdate</string>
      <string>tunnel</string>
      <string>run</string>
      <string>errjordan</string>
    </array>
    <key>StandardOutPath</key><string>/Users/jordanc/Library/Logs/Homebrew/cloudflared.log</string>
    <key>StandardErrorPath</key><string>/Users/jordanc/Library/Logs/Homebrew/cloudflared.log</string>
    <key>RunAtLoad</key><true/>
  </dict>
</plist>
EOF
```

Create the log directory/file if needed:

```bash
mkdir -p ~/Library/Logs/Homebrew
touch ~/Library/Logs/Homebrew/cloudflared.log
```

> ⚠️ `brew services start cloudflared` will re-copy Homebrew's stock plist and wipe these arguments. If you run it, reapply the block above before restarting the service.

### Manage the tunnel service (via launchctl)

```bash
launchctl bootout gui/$(id -u)/homebrew.mxcl.cloudflared 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/homebrew.mxcl.cloudflared.plist"
launchctl enable gui/$(id -u)/homebrew.mxcl.cloudflared
launchctl kickstart -k gui/$(id -u)/homebrew.mxcl.cloudflared

launchctl print gui/$(id -u)/homebrew\.mxcl\.cloudflared | egrep 'state|pid|last exit'
tail -n 50 ~/Library/Logs/Homebrew/cloudflared.log
```

### Foreground debug

Stop the service first, then run:

```bash
cloudflared tunnel run errjordan
```

Fix any errors, then restore the launchctl sequence above.

### Helpful Cloudflare commands

- `cloudflared tunnel list`
- `cloudflared tunnel info errjordan`
- `cloudflared tunnel route dns errjordan errjordan.dev`
- `dig +short errjordan.dev`

## Tailscale (if the DB is tailnet-only)

```bash
tailscale status
tailscale up
tailscale down
tailscale ping <db-host-or-100.x.y.z>
```

## Troubleshooting Checklist

- Launchd service stuck in `spawn scheduled` → tail logs, run the wrapper manually, fix the underlying error, re-bootstrap.
- GitHub Action fails at “Verify release is running” → follow launchd steps above; the workflow prints the last 200 lines of stdout/stderr.
- Cloudflared exits with code 1 on boot → Homebrew likely rewrote the plist; reapply the here-doc above and re-bootstrap.
- Database issues → `printenv DATABASE_URL`, `dig +short host`, `nc -zv host 5432`.
- IPv4 vs IPv6 mismatch → test both loopback URLs; adjust Phoenix runtime config or Cloudflared ingress.
- Erlang node name conflict → `epmd -names`, then stop the old node with `RELEASE_DISTRIBUTION=name RELEASE_NODE=errjordan@127.0.0.1 "$BIN" stop` or restart epmd (`epmd -kill && epmd -daemon`).
- Runner problems → see the runner section above.

## Safety Notes

- Never commit `.env` contents. Keep the file at `chmod 600`.
- Prefer the launchctl commands in this guide; `brew services` overwrites customized plists.
- When editing plists, ensure they contain absolute paths—launchd does not evaluate environment variables.
- Before pushing code changes from this repo, run `mix precommit` locally (compile with warnings as errors, prune unused deps, format, test).
