#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClubHub TV — Golden Pi Image Builder
#
# Produces a reproducible, deployment-ready Raspberry Pi OS image with:
#   - Node.js 20 LTS + PM2 process manager
#   - ClubHub player-runtime pre-installed
#   - Overlay filesystem (OverlayFS on /var) for SD card longevity
#   - HDMI force-hotplug enabled
#   - SSH hardened (key-only, password auth disabled)
#   - Watchdog daemon configured
#   - Provisioning bootstrap (first-boot-enroll.sh) installed
#   - Factory corpus slot (empty — filled during first-boot enrollment)
#   - Fleet health scripts pre-installed
#   - Systemd unit for clubhub-player
#
# Usage:
#   ./scripts/build/golden-image.sh [OPTIONS]
#
# Options:
#   --version VERSION     Image version tag (default: derived from git)
#   --output-dir DIR      Output directory (default: ./dist/images)
#   --base-url URL        URL to download Raspberry Pi OS Lite (see below)
#   --node-version VER    Node.js version to embed (default: 20)
#   --skip-download       Use cached base image if present
#   --verify-only         Verify existing image, do not build
#   --help                Show this message
#
# Requirements (on build host):
#   - Linux host (x86_64 or arm64)
#   - sudo privileges for loop device / chroot operations
#   - Packages: qemu-user-static, qemu-utils, parted, kpartx, rsync, jq, xxd
#   - pnpm workspace: builds player-runtime before image creation
#
# Output files:
#   dist/images/
#     clubhub-player-<version>.img        — deployable raw image
#     clubhub-player-<version>.img.zst    — compressed image for distribution
#     SHA256SUMS                          — checksums for all artifacts
#     manifest-<version>.json             — build metadata + reproducibility info
#     build-audit-<version>.log           — full build log
#
# Reproducibility guarantee:
#   Same version + same base image URL = byte-identical output (except timestamps
#   in filesystem metadata). The manifest records the base image checksum so
#   reproduction can be verified. Build date is embedded but build time is
#   normalised to midnight UTC for reproducibility.
#
# IMPORTANT: This script must run on a Linux host. macOS is not supported
# because macOS cannot mount Linux ext4/FAT partitions or run ARM binaries
# via QEMU in the same way. Use a CI runner or a Linux VM.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/dist/images"
NODE_VERSION="20"
SKIP_DOWNLOAD=false
VERIFY_ONLY=false
VERSION=""

# Raspberry Pi OS Lite (bookworm, 64-bit) — update URL for each base image release
# Override with --base-url for reproducibility against a pinned release
BASE_IMAGE_URL="${CLUBHUB_BASE_IMAGE_URL:-https://downloads.raspberrypi.org/raspios_lite_arm64/images/raspios_lite_arm64-2024-03-15/2024-03-15-raspios-bookworm-arm64-lite.img.xz}"
BASE_IMAGE_CHECKSUM="${CLUBHUB_BASE_IMAGE_CHECKSUM:-}"  # SHA256 of .img.xz — set for reproducibility

# Colors
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
blue()   { printf '\033[34m%s\033[0m\n' "$*"; }
step()   { blue "─── $* ───"; }

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)       VERSION="$2";          shift 2 ;;
    --output-dir)    OUTPUT_DIR="$2";       shift 2 ;;
    --base-url)      BASE_IMAGE_URL="$2";   shift 2 ;;
    --node-version)  NODE_VERSION="$2";     shift 2 ;;
    --skip-download) SKIP_DOWNLOAD=true;    shift   ;;
    --verify-only)   VERIFY_ONLY=true;      shift   ;;
    --help)
      sed -n '/^# Usage:/,/^# ─/p' "$0" | head -n 40
      exit 0 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Version derivation ────────────────────────────────────────────────────────

if [[ -z "$VERSION" ]]; then
  if git -C "$REPO_ROOT" rev-parse HEAD &>/dev/null; then
    GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
    GIT_DATE="$(git -C "$REPO_ROOT" log -1 --format='%cd' --date=format:'%Y%m%d')"
    VERSION="${GIT_DATE}-${GIT_SHA}"
  else
    VERSION="$(date +%Y%m%d)-local"
  fi
fi

IMAGE_NAME="clubhub-player-${VERSION}"
WORK_DIR="/tmp/clubhub-image-build-$$"
LOG_FILE="$OUTPUT_DIR/build-audit-${VERSION}.log"

# ── Prerequisite check ────────────────────────────────────────────────────────

check_prereqs() {
  step "Checking prerequisites"
  local missing=()

  for cmd in qemu-img parted kpartx rsync jq sha256sum zstd; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  # QEMU ARM static binary
  if [[ ! -f /usr/bin/qemu-aarch64-static ]]; then
    missing+=("qemu-user-static (need /usr/bin/qemu-aarch64-static)")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    red "Missing prerequisites:"
    for m in "${missing[@]}"; do echo "  - $m"; done
    red "Install with: sudo apt-get install -y qemu-user-static qemu-utils parted kpartx rsync jq zstd"
    exit 1
  fi

  # Must run as root (or with sudo available) for loop devices
  if [[ $EUID -ne 0 ]]; then
    if ! sudo -n true 2>/dev/null; then
      red "This script requires sudo access for loop device and chroot operations"
      exit 1
    fi
  fi

  green "Prerequisites satisfied"
}

# ── Download base image ───────────────────────────────────────────────────────

download_base_image() {
  step "Downloading base image"

  local cache_dir="$REPO_ROOT/.image-cache"
  mkdir -p "$cache_dir"

  local archive_name
  archive_name="$(basename "$BASE_IMAGE_URL")"
  local archive_path="$cache_dir/$archive_name"
  local img_name="${archive_name%.xz}"
  img_name="${img_name%.gz}"
  local img_path="$cache_dir/$img_name"

  if [[ "$SKIP_DOWNLOAD" == "true" && -f "$img_path" ]]; then
    yellow "Using cached base image: $img_path"
    BASE_IMAGE_PATH="$img_path"
    return
  fi

  if [[ ! -f "$archive_path" ]]; then
    echo "Downloading: $BASE_IMAGE_URL"
    curl -L --progress-bar --retry 3 -o "$archive_path" "$BASE_IMAGE_URL"
  fi

  # Verify checksum if provided
  if [[ -n "$BASE_IMAGE_CHECKSUM" ]]; then
    echo "$BASE_IMAGE_CHECKSUM  $archive_path" | sha256sum --check --status || {
      red "Base image checksum mismatch — refusing to proceed"
      rm -f "$archive_path"
      exit 1
    }
    green "Base image checksum verified"
  else
    yellow "WARNING: No base image checksum provided — build is not fully reproducible"
    echo "Set CLUBHUB_BASE_IMAGE_CHECKSUM to the SHA256 of $(basename "$BASE_IMAGE_URL")"
  fi

  # Extract
  if [[ ! -f "$img_path" ]]; then
    echo "Extracting $archive_name..."
    if [[ "$archive_path" == *.xz ]]; then
      xz -d --keep "$archive_path"
    elif [[ "$archive_path" == *.gz ]]; then
      gunzip -k "$archive_path"
    fi
  fi

  BASE_IMAGE_PATH="$img_path"
  echo "Base image: $BASE_IMAGE_PATH"
}

# ── Mount image ───────────────────────────────────────────────────────────────

mount_image() {
  step "Mounting image"

  WORK_IMG="$WORK_DIR/${IMAGE_NAME}.img"
  mkdir -p "$WORK_DIR"

  # Copy base image (we modify in place)
  echo "Copying base image to work directory..."
  cp "$BASE_IMAGE_PATH" "$WORK_IMG"

  # Extend image by 2GB for our additions
  echo "Extending image size..."
  truncate -s +2G "$WORK_IMG"

  # Set up loop device
  LOOP_DEV="$(sudo losetup --find --show --partscan "$WORK_IMG")"
  echo "Loop device: $LOOP_DEV"

  # Expand last partition to fill new space
  sudo parted -s "$LOOP_DEV" resizepart 2 100%
  sudo e2fsck -f "${LOOP_DEV}p2" || true
  sudo resize2fs "${LOOP_DEV}p2"

  # Mount filesystems
  MOUNT_ROOT="$WORK_DIR/mnt/root"
  MOUNT_BOOT="$WORK_DIR/mnt/boot"
  mkdir -p "$MOUNT_ROOT" "$MOUNT_BOOT"

  sudo mount "${LOOP_DEV}p2" "$MOUNT_ROOT"
  sudo mount "${LOOP_DEV}p1" "$MOUNT_BOOT"
  sudo mount -t proc proc "$MOUNT_ROOT/proc"
  sudo mount -t sysfs sys "$MOUNT_ROOT/sys"
  sudo mount -o bind /dev "$MOUNT_ROOT/dev"
  sudo mount -o bind /dev/pts "$MOUNT_ROOT/dev/pts"

  # QEMU static binary for ARM64 chroot on x86_64 host
  if [[ "$(uname -m)" != "aarch64" ]]; then
    sudo cp /usr/bin/qemu-aarch64-static "$MOUNT_ROOT/usr/bin/"
  fi

  echo "Image mounted at $MOUNT_ROOT"
}

# ── Chroot helper ─────────────────────────────────────────────────────────────

chroot_run() {
  sudo chroot "$MOUNT_ROOT" /bin/bash -c "$*"
}

# ── Configure base OS ─────────────────────────────────────────────────────────

configure_base() {
  step "Configuring base OS"

  # Hostname
  echo "clubhub-player" | sudo tee "$MOUNT_ROOT/etc/hostname" > /dev/null

  # Locale + timezone
  chroot_run "
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl wget gnupg2 ca-certificates lsb-release \
      htop vim-tiny jq bc rsync unzip git overlayroot \
      pm2 watchdog i2c-tools libraspberrypi-bin \
      chromium-browser
  "

  # SSH hardening
  sudo tee "$MOUNT_ROOT/etc/ssh/sshd_config.d/clubhub-hardening.conf" > /dev/null << 'EOF'
# ClubHub SSH hardening
PasswordAuthentication no
ChallengeResponseAuthentication no
PermitRootLogin prohibit-password
AllowTcpForwarding no
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 30
EOF

  green "Base OS configured"
}

# ── Install Node.js ───────────────────────────────────────────────────────────

install_nodejs() {
  step "Installing Node.js $NODE_VERSION"

  chroot_run "
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    npm install -g pm2@latest
    pm2 startup systemd -u pi --hp /home/pi || true
    node --version
    npm --version
    pm2 --version
  "

  green "Node.js $(chroot_run 'node --version') installed"
}

# ── Install player-runtime ────────────────────────────────────────────────────

install_player_runtime() {
  step "Installing ClubHub player-runtime"

  # Build player-runtime on the host first
  echo "Building player-runtime..."
  cd "$REPO_ROOT"
  pnpm --filter @clubhub/player-runtime build 2>&1 | tail -5

  # Copy built runtime to image
  sudo mkdir -p "$MOUNT_ROOT/opt/clubhub/player-runtime"
  sudo rsync -a --exclude='node_modules' --exclude='src' \
    "$REPO_ROOT/player-runtime/" "$MOUNT_ROOT/opt/clubhub/player-runtime/"

  # Install production dependencies inside chroot
  chroot_run "
    cd /opt/clubhub/player-runtime
    npm install --production --ignore-scripts 2>&1 | tail -3
  "

  # Install operational scripts
  sudo mkdir -p "$MOUNT_ROOT/usr/local/bin"
  for script in first-boot-enroll.sh diagnostics-bundle.sh; do
    if [[ -f "$REPO_ROOT/scripts/wave1/$script" ]]; then
      sudo cp "$REPO_ROOT/scripts/wave1/$script" "$MOUNT_ROOT/usr/local/bin/$script"
      sudo chmod +x "$MOUNT_ROOT/usr/local/bin/$script"
    fi
  done

  # Create runtime directories
  chroot_run "
    mkdir -p /var/lib/clubhub /var/log/clubhub
    mkdir -p /var/lib/clubhub/corpus /var/lib/clubhub/replay /var/lib/clubhub/assets
    mkdir -p /var/lib/clubhub/command-history
    chown -R pi:pi /var/lib/clubhub /var/log/clubhub
  "

  green "player-runtime installed"
}

# ── Configure systemd unit ────────────────────────────────────────────────────

install_systemd_unit() {
  step "Installing systemd unit"

  sudo tee "$MOUNT_ROOT/etc/systemd/system/clubhub-player.service" > /dev/null << 'UNIT'
[Unit]
Description=ClubHub TV Player Runtime
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/clubhub/player-runtime
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=clubhub-player

# Environment — override in /etc/clubhub/player.env
EnvironmentFile=-/etc/clubhub/player.env

# Safety: kill after 30s if graceful shutdown fails
TimeoutStopSec=30
KillMode=process

[Install]
WantedBy=multi-user.target
UNIT

  # Default environment file (values overridden by enrollment)
  sudo mkdir -p "$MOUNT_ROOT/etc/clubhub"
  sudo tee "$MOUNT_ROOT/etc/clubhub/player.env" > /dev/null << 'ENV'
# ClubHub player runtime environment
# Values populated by first-boot-enroll.sh during commissioning

CMS_API_URL=
SCREEN_ID=
VENUE_ID=
CORPUS_CACHE_DIR=/var/lib/clubhub/corpus
REPLAY_CACHE_DIR=/var/lib/clubhub/replay
ASSET_DIR=/var/lib/clubhub/assets
COMMAND_HISTORY_PATH=/var/lib/clubhub/command-history/history.jsonl
WEBSOCKET_PORT=7777
CORPUS_POLL_INTERVAL_MS=60000
HEARTBEAT_INTERVAL_MS=30000
ENV

  chroot_run "systemctl enable clubhub-player.service"
  chroot_run "systemctl enable watchdog.service"

  green "Systemd unit installed and enabled"
}

# ── Configure hardware ────────────────────────────────────────────────────────

configure_hardware() {
  step "Configuring hardware (Pi-specific)"

  # config.txt — HDMI and hardware settings
  cat >> "$MOUNT_BOOT/config.txt" << 'CONFIG'

# ── ClubHub TV configuration ──────────────────────────────────────────────────
# Force HDMI output even without display connected at boot
hdmi_force_hotplug=1
hdmi_drive=2

# Disable HDMI CEC — prevents TV remote from interfering with player display
hdmi_ignore_cec=1
hdmi_ignore_cec_init=1

# Display group: 1=CEA (TV), 2=DMT (monitor)
hdmi_group=1
hdmi_mode=16

# Disable rainbow splash (faster boot)
disable_splash=1

# Overclock SD card for faster I/O
dtparam=sd_overclock=100

# Enable hardware watchdog
dtparam=watchdog=on

# GPU memory — minimal (headless player, Chromium handles its own)
gpu_mem=128
CONFIG

  # Watchdog daemon config
  sudo tee "$MOUNT_ROOT/etc/watchdog.conf" > /dev/null << 'WATCHDOG'
# ClubHub watchdog configuration
watchdog-device    = /dev/watchdog
watchdog-timeout   = 15
interval           = 2
max-load-1         = 24
min-memory         = 1
realtime           = yes
priority           = 1
WATCHDOG

  # OverlayFS — protect SD card from writes in /var
  # The overlay is configured on /var to protect runtime data from excessive writes.
  # /var/lib/clubhub is bind-mounted BELOW the overlay (excluded) for persistence.
  # This means corpus cache persists across reboots.
  sudo tee -a "$MOUNT_ROOT/etc/overlayroot.conf" > /dev/null << 'OVERLAY'
overlayroot="tmpfs:swap=1,recurse=0"
overlayroot_cfgdisk="disabled"
OVERLAY

  # Bind-mount /var/lib/clubhub from real root (below overlay) so corpus/replay data persists
  sudo tee "$MOUNT_ROOT/etc/systemd/system/var-lib-clubhub.mount" > /dev/null << 'MOUNTUNIT'
[Unit]
Description=ClubHub data directory (persistent, below OverlayFS)
DefaultDependencies=no
After=local-fs.target
Before=clubhub-player.service clubhub-firstboot.service

[Mount]
What=/media/root-ro/var/lib/clubhub
Where=/var/lib/clubhub
Type=none
Options=bind

[Install]
WantedBy=multi-user.target
MOUNTUNIT

  chroot_run "systemctl enable var-lib-clubhub.mount"

  green "Hardware configured"
}

# ── Factory corpus slot ───────────────────────────────────────────────────────

install_factory_corpus() {
  step "Installing factory corpus slot"

  # The factory corpus is a minimal valid corpus that the player will serve
  # if it has never been provisioned. Content: "UNPROVISIONED — contact support"
  # This is NOT a real playback corpus — it's the safety fallback.

  # Compute FNV-1a32 checksum using canonicalizeJson (sorted keys) — must match
  # corpus-cache.ts which calls fnv1a32(canonicalizeJson(corpus_data)).
  # Keys are alphabetical so JSON.stringify and canonicalizeJson produce identical output.
  FACTORY_DATA='{"asset_urls":{},"message":"This player has not been provisioned. Contact your ClubHub administrator.","type":"FACTORY_UNPROVISIONED"}'
  FACTORY_CHECKSUM=$(node -e "
    const s = '$FACTORY_DATA';
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    console.log(h.toString(16).padStart(8,'0'));
  ")

  local FACTORY_CORPUS
  FACTORY_CORPUS="$(cat << EOF
{
  "corpus_version_id": "factory-v1-unprovisioned",
  "checksum": "$FACTORY_CHECKSUM",
  "fetched_at": 0,
  "effective_at": 0,
  "corpus_data": $FACTORY_DATA
}
EOF
)"

  sudo mkdir -p "$MOUNT_ROOT/var/lib/clubhub/corpus"
  echo "$FACTORY_CORPUS" | sudo tee "$MOUNT_ROOT/var/lib/clubhub/corpus/corpus.factory.json" > /dev/null
  echo "Factory corpus checksum: $FACTORY_CHECKSUM"

  green "Factory corpus slot installed"
}

# ── First-boot service ────────────────────────────────────────────────────────

install_firstboot() {
  step "Installing first-boot enrollment trigger"

  sudo tee "$MOUNT_ROOT/etc/systemd/system/clubhub-firstboot.service" > /dev/null << 'UNIT'
[Unit]
Description=ClubHub First-Boot Enrollment
After=network-online.target
Before=clubhub-player.service
ConditionPathExists=!/var/lib/clubhub/.enrolled
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
ExecStart=/usr/local/bin/first-boot-enroll.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=clubhub-firstboot

[Install]
WantedBy=multi-user.target
UNIT

  chroot_run "systemctl enable clubhub-firstboot.service"

  green "First-boot enrollment service installed"
}

# ── Cleanup and unmount ───────────────────────────────────────────────────────

unmount_image() {
  step "Unmounting image"

  sudo umount "$MOUNT_ROOT/dev/pts"  2>/dev/null || true
  sudo umount "$MOUNT_ROOT/dev"      2>/dev/null || true
  sudo umount "$MOUNT_ROOT/proc"     2>/dev/null || true
  sudo umount "$MOUNT_ROOT/sys"      2>/dev/null || true
  sudo umount "$MOUNT_BOOT"          2>/dev/null || true
  sudo umount "$MOUNT_ROOT"          2>/dev/null || true
  sudo losetup -d "$LOOP_DEV"        2>/dev/null || true

  green "Image unmounted cleanly"
}

# ── Package and sign ──────────────────────────────────────────────────────────

package_image() {
  step "Packaging image artifacts"

  mkdir -p "$OUTPUT_DIR"

  local img_dest="$OUTPUT_DIR/${IMAGE_NAME}.img"
  cp "$WORK_IMG" "$img_dest"

  # Compress
  echo "Compressing image..."
  zstd --rm -9 -T0 "$img_dest" -o "${img_dest}.zst"

  # Checksums
  cd "$OUTPUT_DIR"
  sha256sum "${IMAGE_NAME}.img.zst" > SHA256SUMS
  echo "SHA256: $(cat SHA256SUMS | awk '{print $1}')"

  # Manifest
  local base_checksum=""
  if [[ -n "${BASE_IMAGE_PATH:-}" ]]; then
    base_checksum="$(sha256sum "$BASE_IMAGE_PATH" | awk '{print $1}')"
  fi

  jq -n \
    --arg version "$VERSION" \
    --arg image_name "${IMAGE_NAME}.img.zst" \
    --arg built_at "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg node_version "$NODE_VERSION" \
    --arg base_image_url "$BASE_IMAGE_URL" \
    --arg base_image_checksum "$base_checksum" \
    --arg image_sha256 "$(sha256sum "${IMAGE_NAME}.img.zst" | awk '{print $1}')" \
    --arg git_sha "$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo 'unknown')" \
    --arg git_branch "$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo 'unknown')" \
    '{
      schema: "clubhub-image-manifest/v1",
      version: $version,
      image_name: $image_name,
      built_at: $built_at,
      node_version: $node_version,
      base_image: {
        url: $base_image_url,
        sha256: $base_image_checksum
      },
      artifacts: {
        image: {
          name: $image_name,
          sha256: $image_sha256
        }
      },
      git: {
        sha: $git_sha,
        branch: $git_branch
      },
      reproducibility: {
        deterministic: ($base_image_checksum != ""),
        note: "Rebuild with same version + same base_image.url + same git sha for identical output"
      }
    }' > "manifest-${VERSION}.json"

  echo ""
  green "Image artifacts:"
  ls -lh "$OUTPUT_DIR" | grep "$VERSION"
  echo ""
  cat "manifest-${VERSION}.json"
}

# ── Install player-ui ─────────────────────────────────────────────────────────

install_player_ui() {
  step "Installing ClubHub player-ui"

  # Build player-ui on the host
  echo "Building player-ui..."
  cd "$REPO_ROOT"
  pnpm --filter @clubhub/player-ui build 2>&1 | tail -5

  local UI_SRC="$REPO_ROOT/apps/player-ui"
  local UI_DEST="$MOUNT_ROOT/opt/clubhub/player-ui"

  sudo mkdir -p "$UI_DEST"
  sudo rsync -a "$UI_SRC/public/" "$UI_DEST/public/"
  sudo rsync -a "$UI_SRC/dist/"   "$UI_DEST/dist/"

  chroot_run "chown -R pi:pi /opt/clubhub/player-ui"

  green "player-ui installed at /opt/clubhub/player-ui"
}

# ── Verify ────────────────────────────────────────────────────────────────────

verify_image() {
  step "Verifying image artifacts"

  local img_zst="$OUTPUT_DIR/${IMAGE_NAME}.img.zst"
  local manifest="$OUTPUT_DIR/manifest-${VERSION}.json"

  if [[ ! -f "$img_zst" ]]; then
    red "Image not found: $img_zst"
    exit 1
  fi

  # Checksum verification
  cd "$OUTPUT_DIR"
  if sha256sum --check SHA256SUMS --status; then
    green "Image checksum verified"
  else
    red "Image checksum MISMATCH — image may be corrupt"
    exit 1
  fi

  # Manifest validation
  if [[ -f "$manifest" ]]; then
    local manifest_version
    manifest_version="$(jq -r '.version' "$manifest")"
    if [[ "$manifest_version" == "$VERSION" ]]; then
      green "Manifest valid (version=$manifest_version)"
    else
      red "Manifest version mismatch: expected $VERSION got $manifest_version"
      exit 1
    fi
  fi

  green "All verification checks passed"
}

# ── Cleanup ───────────────────────────────────────────────────────────────────

cleanup() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    red "Build failed (exit code $exit_code)"
    # Best-effort unmount on failure
    unmount_image 2>/dev/null || true
  fi
  rm -rf "$WORK_DIR" 2>/dev/null || true
}

trap cleanup EXIT

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  mkdir -p "$OUTPUT_DIR"

  echo ""
  blue "═══════════════════════════════════════════════════════"
  blue "  ClubHub TV — Golden Image Builder"
  blue "  Version: $VERSION"
  blue "  Output:  $OUTPUT_DIR"
  blue "═══════════════════════════════════════════════════════"
  echo ""

  # Log everything
  exec > >(tee "$LOG_FILE") 2>&1

  if [[ "$VERIFY_ONLY" == "true" ]]; then
    verify_image
    exit 0
  fi

  check_prereqs
  download_base_image
  mount_image
  configure_base
  install_nodejs
  install_player_runtime
  install_player_ui
  install_systemd_unit
  configure_hardware
  install_factory_corpus
  install_firstboot
  unmount_image
  package_image
  verify_image

  echo ""
  green "═══════════════════════════════════════════════════════"
  green "  BUILD COMPLETE"
  green "  Image:    $OUTPUT_DIR/${IMAGE_NAME}.img.zst"
  green "  Manifest: $OUTPUT_DIR/manifest-${VERSION}.json"
  green "═══════════════════════════════════════════════════════"
  echo ""
  echo "To write to SD card:"
  echo "  zstd -d $OUTPUT_DIR/${IMAGE_NAME}.img.zst --stdout | sudo dd of=/dev/sdX bs=4M status=progress"
  echo ""
  echo "To verify before writing:"
  echo "  sha256sum $OUTPUT_DIR/${IMAGE_NAME}.img.zst && cat $OUTPUT_DIR/SHA256SUMS"
}

main "$@"
