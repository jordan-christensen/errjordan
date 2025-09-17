# Lunar-Whale Ops Cheat Sheet

Quick commands to operate the errjordan app on the production Mac (lunar-whale).

- Paths
  - App home: `~/apps/errjordan`
  - Current release bin: `~/apps/errjordan/current/bin/errjordan` (referred to as `$BIN`)
  - Env file (create/edit): `~/apps/errjordan/.env`
  - Cloudflared config: `~/.cloudflared/config.yml`
  - GitHub runner: `~/actions-runner`

## GitHub Actions Runner

- Status/start/stop (service):
  - `cd ~/actions-runner`
  - `./svc.sh status`
  - `./svc.sh start`
  - `./svc.sh stop`
  - Install as service (once): `./svc.sh install`
- Run interactively (debug logs):
  - `cd ~/actions-runner && ./run.sh`
- Check logs:
  - `tail -f ~/actions-runner/_diag/*.log`

### Runner recovery checklist

- If jobs queue and runner shows Offline or Started: 0
  - `cd ~/actions-runner && ./svc.sh status`
  - `./svc.sh start` (or `./svc.sh uninstall && ./svc.sh install` if needed)
- If service fails to load
  - Clear quarantine on launch scripts: `xattr -d com.apple.quarantine ~/actions-runner/runsvc.sh ~/actions-runner/run.sh 2>/dev/null || true`
  - Ensure exec bits: `chmod +x ~/actions-runner/{runsvc.sh,run.sh}` and `chmod +x ~/actions-runner/bin/* 2>/dev/null || true`
  - Unload + bootstrap: `launchctl bootout gui/$(id -u)/actions.runner.* 2>/dev/null || true` then `launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/actions.runner.jordan-christensen-errjordan.lunar-whale.plist"`
  - Inspect: `launchctl print gui/$(id -u)/actions.runner.jordan-christensen-errjordan.lunar-whale | egrep 'state|pid|last exit'`
- If credentials/labels are stale
  - `./config.sh remove || true`
  - Reconfigure with fresh token: `./config.sh --url https://github.com/<owner>/<repo> --token <token> --labels "self-hosted,macos,x64"`
  - `./svc.sh install && ./svc.sh start`
- Prove connectivity
  - `cd ~/actions-runner && ./run.sh` (expect “Connected to GitHub”, “Listening for Jobs”, labels listed)
  - GitHub → Settings → Actions → Runners → should show “Idle” with labels `self-hosted, macos, x64`

## App Environment (.env)

Create `~/apps/errjordan/.env` and keep it `chmod 600`:

```
PHX_SERVER=true
PHX_HOST=errjordan.dev
PORT=4444
SECRET_KEY_BASE=...64-byte-secret...
DATABASE_URL=ecto://USER:PASS@DB_HOST:5432/DB_NAME
# Pin a stable node name to avoid hostname conflicts
RELEASE_DISTRIBUTION=name
RELEASE_NODE=errjordan@127.0.0.1
```

Export quickly in a shell:

```
set -a; . "$HOME/apps/errjordan/.env"; set +a
printenv | egrep '^(PHX_SERVER|PHX_HOST|PORT|SECRET_KEY_BASE|DATABASE_URL|RELEASE_)='
```

## App (Release) Lifecycle

- Attached (see logs/errors):
  - `set -a; . "$HOME/apps/errjordan/.env"; set +a`
  - `"$HOME/apps/errjordan/current/bin/errjordan" start_iex`
  - Stop: Ctrl+C twice
- Background (daemon):
  - `set -a; . "$HOME/apps/errjordan/.env"; set +a`
  - `"$HOME/apps/errjordan/current/bin/errjordan" daemon`
- Health/controls:
  - PID: `"$HOME/apps/errjordan/current/bin/errjordan" pid`
  - Stop: `"$HOME/apps/errjordan/current/bin/errjordan" stop`
  - Eval (migrations):
    - `"$HOME/apps/errjordan/current/bin/errjordan" eval 'Ecto.Migrator.with_repo(Errjordan.Repo, &Ecto.Migrator.run(&1, :up, all: true))'`
- Local checks:
  - IPv4: `curl -v http://127.0.0.1:4444/`
  - IPv6: `curl -g -v http://[::1]:4444/`
  - Port listener: `lsof -nP -iTCP:4444 -sTCP:LISTEN`

## Launchd Service (keep app running)

Wrapper script at `~/apps/errjordan/bin/errjordan-launchd.sh` (make executable):

```
#!/usr/bin/env bash
set -euo pipefail
APP_HOME="$HOME/apps/errjordan"
ENV_FILE="$APP_HOME/.env"
BIN="$APP_HOME/current/bin/errjordan"
mkdir -p "$APP_HOME/log"
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
# Foreground so launchd supervises it
exec "$BIN" start
```

LaunchAgent at `~/Library/LaunchAgents/dev.errjordan.app.plist` (use `cat <<EOF` so `$HOME` expands when writing the file):

```
cat <<EOF > ~/Library/LaunchAgents/dev.errjordan.app.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>dev.errjordan.app</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>${HOME}/apps/errjordan/bin/errjordan-launchd.sh</string>
    </array>
    <key>WorkingDirectory</key><string>${HOME}/apps/errjordan</string>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>${HOME}/apps/errjordan/log/errjordan.out.log</string>
    <key>StandardErrorPath</key><string>${HOME}/apps/errjordan/log/errjordan.err.log</string>
  </dict>
  </plist>
EOF
```

<!-- Launchd does not perform environment substitution inside those paths; the `cat <<EOF` command above writes absolute paths. If you already created the plist with literal `$HOME`, run `sed -i '' "s|\$HOME|$HOME|g" ~/Library/LaunchAgents/dev.errjordan.app.plist` to fix it. -->

Enable/restart:

```
launchctl bootout gui/$(id -u)/dev.errjordan.app 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$HOME/Library/LaunchAgents/dev.errjordan.app.plist"
launchctl enable gui/$(id -u)/dev.errjordan.app
launchctl kickstart -k gui/$(id -u)/dev.errjordan.app
```

Check:

```
launchctl print gui/$(id -u)/dev.errjordan.app | egrep 'state|pid|last exit'
tail -f ~/apps/errjordan/log/errjordan.{out,err}.log
```

## Cloudflare Tunnel

- Inspect tunnels:
  - `cloudflared tunnel list`
  - `cloudflared tunnel info errjordan`
- DNS route (apex):
  - `cloudflared tunnel route dns errjordan errjordan.dev`
- Config `~/.cloudflared/config.yml` (example):

```
tunnel: <TUNNEL_ID>
credentials-file: /Users/jordanc/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: errjordan.dev
    service: http://127.0.0.1:4444  # or http://[::1]:4444 if IPv6 only
  - hostname: www.errjordan.dev
    service: http://127.0.0.1:4444
  - service: http_status:404
```

- Run foreground (debug): `cloudflared tunnel run errjordan`
- Run as service: `cloudflared service install && brew services start cloudflared`
- Check service: `brew services list | grep cloudflared`
- DNS quick check: `dig +short errjordan.dev` (returns Cloudflare Anycast IPs)

## Tailscale (if DB is tailnet-only)

- Status: `tailscale status`
- Up/Down: `tailscale up` / `tailscale down`
- Ping DB host: `tailscale ping <db-host-or-100.x.y.z>`

## Troubleshooting

- Missing env at boot:
  - Use `export ...` or source `.env` with `set -a; . .env; set +a` before `$BIN ...`
- DB host resolution/port reachability:
  - `printenv DATABASE_URL`
  - `dig +short <db-host>`
  - `nc -zv <db-host> 5432`
- IPv4 vs IPv6 binding:
  - Test both curl variants above; adjust cloudflared service to `http://[::1]:4444` or bind Phoenix to IPv4 in `config/runtime.exs` (`ip: {127,0,0,1}`) and redeploy.
- Stale Erlang node name:
  - `epmd -names` → if `errjordan` appears, try: `RELEASE_DISTRIBUTION=name RELEASE_NODE=errjordan@lunar-whale "$BIN" stop`
  - If needed: `epmd -kill && epmd -daemon`
  - Prefer fixed node name via `.env`: `RELEASE_NODE=errjordan@127.0.0.1`
- Release controls at a glance:
  - Start attached: `"$BIN" start_iex`
  - Start daemon: `"$BIN" daemon`
  - Stop: `"$BIN" stop`
  - PID: `"$BIN" pid`
  - Migrate: `"$BIN" eval 'Ecto.Migrator.with_repo(Errjordan.Repo, &Ecto.Migrator.run(&1, :up, all: true))'`

## Safety Notes

- Keep `~/apps/errjordan/.env` permissions strict: `chmod 600`.
- Don’t commit secrets. The `.env` lives only on lunar-whale.
- For CI deploys, secrets are injected via GitHub Actions; for manual starts, source `.env` first.
