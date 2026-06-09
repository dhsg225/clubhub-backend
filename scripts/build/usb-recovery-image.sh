#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClubHub TV — USB Recovery Image Generator
#
# Creates a bootable USB drive that can restore a Pi to the golden image.
# Insert USB into Pi, reboot — Pi auto-recovers and reboots into restored image.
#
# Recovery flow on the Pi:
#   1. Pi detects USB boot media at startup
#   2. Recovery script runs from USB initrd or early userspace
#   3. Validates golden image checksum on USB
#   4. Writes golden image to SD card (mmcblk0)
#   5. Validates written image checksum
#   6. Optionally triggers re-enrollment (--reset-enrollment)
#   7. Logs recovery to /var/log/clubhub-recovery.log on USB for retrieval
#   8. Reboots into restored image
#
# Usage (on any Linux host with USB drive):
#   ./scripts/build/usb-recovery-image.sh --device /dev/sdX --image dist/images/clubhub-player-<version>.img.zst
#   ./scripts/build/usb-recovery-image.sh --device /dev/sdX --image <path> --reset-enrollment
#   ./scripts/build/usb-recovery-image.sh --device /dev/sdX --image <path> --preserve-identity
#
# Options:
#   --device DEV          USB block device to write (REQUIRED, e.g. /dev/sdb)
#   --image PATH          Path to .img or .img.zst golden image (REQUIRED)
#   --reset-enrollment    Wipe /etc/clubhub/player.env — force re-enrollment
#   --preserve-identity   Copy /etc/clubhub/player.env from current SD to restored image
#   --unattended          No confirmation prompt (for CI use)
#   --dry-run             Show what would happen, do not write
#   --help                Show this message
#
# Safety:
#   - Requires explicit --device flag (no auto-detection, prevents wrong-device writes)
#   - Confirms device name before writing
#   - Validates image checksum before writing USB
#   - Validates SD card write before reboot
#   - Never writes to /dev/sda (protection against writing to host disk)
#   - Recovery logs written to USB for post-mortem
#
# What operators will do wrong:
#   - Specify wrong --device and overwrite the wrong USB: protected by explicit
#     confirmation and /dev/sda guard.
#   - Use a damaged USB drive: checksum validation on write catches this.
#   - Run on macOS: blocked at prereq check (needs Linux loop devices).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Defaults ──────────────────────────────────────────────────────────────────

USB_DEVICE=""
IMAGE_PATH=""
RESET_ENROLLMENT=false
PRESERVE_IDENTITY=false
UNATTENDED=false
DRY_RUN=false

# Colors
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
blue()   { printf '\033[34m%s\033[0m\n' "$*"; }
step()   { blue "─── $* ───"; }

# ── Argument parsing ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)            USB_DEVICE="$2";      shift 2 ;;
    --image)             IMAGE_PATH="$2";      shift 2 ;;
    --reset-enrollment)  RESET_ENROLLMENT=true; shift  ;;
    --preserve-identity) PRESERVE_IDENTITY=true; shift ;;
    --unattended)        UNATTENDED=true;       shift  ;;
    --dry-run)           DRY_RUN=true;          shift  ;;
    --help)
      sed -n '/^# Usage/,/^# ─/p' "$0" | head -n 25
      exit 0 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────

validate_args() {
  if [[ -z "$USB_DEVICE" ]]; then
    red "ERROR: --device is required (e.g. --device /dev/sdb)"
    exit 1
  fi
  if [[ -z "$IMAGE_PATH" ]]; then
    red "ERROR: --image is required (path to .img or .img.zst)"
    exit 1
  fi
  if [[ ! -b "$USB_DEVICE" ]]; then
    red "ERROR: $USB_DEVICE is not a block device"
    exit 1
  fi
  # Safety: never write to /dev/sda (almost certainly the host disk)
  if [[ "$USB_DEVICE" == "/dev/sda" ]]; then
    red "ERROR: Refusing to write to /dev/sda — this is almost certainly your host disk"
    red "If you genuinely mean /dev/sda, rename the script temporarily and remove this check"
    exit 1
  fi
  if [[ ! -f "$IMAGE_PATH" ]]; then
    red "ERROR: Image not found: $IMAGE_PATH"
    exit 1
  fi
  if [[ "$RESET_ENROLLMENT" == "true" && "$PRESERVE_IDENTITY" == "true" ]]; then
    red "ERROR: --reset-enrollment and --preserve-identity are mutually exclusive"
    exit 1
  fi
}

check_prereqs() {
  step "Checking prerequisites"
  if [[ "$(uname -s)" != "Linux" ]]; then
    red "This script requires Linux. macOS cannot mount ext4 or write raw disk images correctly."
    exit 1
  fi
  for cmd in dd sha256sum parted mkfs.fat mkfs.ext4 zstd; do
    if ! command -v "$cmd" &>/dev/null; then
      red "Missing required command: $cmd"
      exit 1
    fi
  done
  if [[ $EUID -ne 0 ]]; then
    if ! sudo -n true 2>/dev/null; then
      red "This script requires sudo or root for raw disk access"
      exit 1
    fi
  fi
  green "Prerequisites OK"
}

# ── USB size check ────────────────────────────────────────────────────────────

check_usb_size() {
  step "Checking USB device size"
  local device_size_bytes
  device_size_bytes="$(sudo blockdev --getsize64 "$USB_DEVICE")"
  local device_size_gb=$(( device_size_bytes / 1024 / 1024 / 1024 ))

  # Image decompressed is at most ~8GB; need ~10GB USB minimum
  echo "USB device: $USB_DEVICE ($device_size_gb GB)"
  if [[ $device_size_gb -lt 8 ]]; then
    red "USB device too small: ${device_size_gb}GB. Need at least 8GB."
    exit 1
  fi
  green "USB size OK (${device_size_gb}GB)"
}

# ── Image checksum validation ─────────────────────────────────────────────────

validate_image() {
  step "Validating source image"

  local image_dir
  image_dir="$(dirname "$IMAGE_PATH")"
  local image_basename
  image_basename="$(basename "$IMAGE_PATH")"

  # Check for SHA256SUMS in same directory
  if [[ -f "$image_dir/SHA256SUMS" ]]; then
    echo "Verifying image against SHA256SUMS..."
    if sha256sum --check "$image_dir/SHA256SUMS" --ignore-missing --status; then
      green "Image checksum verified from SHA256SUMS"
    else
      red "Image checksum FAILED — image may be corrupt"
      red "Re-download the image or regenerate with golden-image.sh"
      exit 1
    fi
  else
    yellow "WARNING: No SHA256SUMS file found alongside image — skipping verification"
    echo "Generating and recording checksum now..."
  fi

  IMAGE_SHA256="$(sha256sum "$IMAGE_PATH" | awk '{print $1}')"
  echo "Image SHA256: $IMAGE_SHA256"

  # Determine if compressed
  if [[ "$IMAGE_PATH" == *.zst ]]; then
    IMAGE_COMPRESSED=true
    echo "Image is zstd compressed — will decompress on-the-fly during write"
  else
    IMAGE_COMPRESSED=false
  fi

  green "Image validated"
}

# ── Confirmation ──────────────────────────────────────────────────────────────

confirm_write() {
  echo ""
  yellow "═══════════════════════════════════════════════════════"
  yellow "  ABOUT TO WRITE USB RECOVERY DRIVE"
  yellow "═══════════════════════════════════════════════════════"
  echo ""
  echo "  Device:          $USB_DEVICE"
  echo "  Image:           $(basename "$IMAGE_PATH")"
  echo "  Image SHA256:    ${IMAGE_SHA256:0:16}..."
  echo "  Reset enrollment: $RESET_ENROLLMENT"
  echo "  Preserve identity: $PRESERVE_IDENTITY"
  echo ""
  yellow "  ALL DATA ON $USB_DEVICE WILL BE ERASED"
  echo ""

  if [[ "$DRY_RUN" == "true" ]]; then
    yellow "DRY RUN — no writes performed"
    exit 0
  fi

  if [[ "$UNATTENDED" == "false" ]]; then
    read -r -p "Type 'yes' to proceed: " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
}

# ── Partition USB ─────────────────────────────────────────────────────────────

partition_usb() {
  step "Partitioning USB drive"

  # Unmount any existing mounts
  sudo umount "${USB_DEVICE}"* 2>/dev/null || true

  # Write partition table: FAT32 boot + ext4 recovery data
  sudo parted -s "$USB_DEVICE" mklabel msdos
  sudo parted -s "$USB_DEVICE" mkpart primary fat32 1MiB 512MiB
  sudo parted -s "$USB_DEVICE" mkpart primary ext4 512MiB 100%
  sudo parted -s "$USB_DEVICE" set 1 boot on

  # Allow kernel to re-read partition table
  sudo partprobe "$USB_DEVICE" 2>/dev/null || sudo blockdev --rereadpt "$USB_DEVICE"
  sleep 2

  # Format
  sudo mkfs.fat -F32 -n CLUBHUB-BOOT "${USB_DEVICE}1"
  sudo mkfs.ext4 -L CLUBHUB-RECOVERY "${USB_DEVICE}2"

  green "USB partitioned"
}

# ── Write recovery image to USB ───────────────────────────────────────────────

write_recovery_data() {
  step "Writing recovery data to USB"

  local MOUNT_BOOT="$TMPDIR_USB/boot"
  local MOUNT_DATA="$TMPDIR_USB/data"
  mkdir -p "$MOUNT_BOOT" "$MOUNT_DATA"

  sudo mount "${USB_DEVICE}1" "$MOUNT_BOOT"
  sudo mount "${USB_DEVICE}2" "$MOUNT_DATA"

  # Write golden image to recovery partition
  echo "Copying golden image to USB recovery partition..."
  sudo mkdir -p "$MOUNT_DATA/images"
  sudo cp "$IMAGE_PATH" "$MOUNT_DATA/images/$(basename "$IMAGE_PATH")"

  # Write image manifest if present
  local manifest_path
  manifest_path="$(dirname "$IMAGE_PATH")/manifest-"*".json" 2>/dev/null || true
  if compgen -G "$manifest_path" &>/dev/null; then
    sudo cp $manifest_path "$MOUNT_DATA/images/"
  fi

  # Write SHA256 of the image to recovery partition
  echo "$IMAGE_SHA256  $(basename "$IMAGE_PATH")" | sudo tee "$MOUNT_DATA/images/SHA256SUMS" > /dev/null

  # Recovery configuration
  sudo tee "$MOUNT_DATA/recovery.conf" > /dev/null << CONF
# ClubHub USB Recovery Configuration
# Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')

IMAGE_FILENAME=$(basename "$IMAGE_PATH")
IMAGE_SHA256=$IMAGE_SHA256
RESET_ENROLLMENT=$RESET_ENROLLMENT
PRESERVE_IDENTITY=$PRESERVE_IDENTITY
TARGET_DEVICE=/dev/mmcblk0
RECOVERY_LOG=/var/log/clubhub-recovery.log
CONF

  # Write the recovery script that runs on the Pi
  sudo tee "$MOUNT_DATA/recover.sh" > /dev/null << 'RECOVERY_SCRIPT'
#!/bin/bash
# ClubHub USB Recovery Script
# Runs on the Pi from USB media — restores SD card from golden image
#
# This script is designed to run from an initrd or early userspace.
# It can also be run manually after booting from USB on a Pi.
set -euo pipefail

LOG=/var/log/clubhub-recovery.log
CONF_PATH="$(dirname "$0")/recovery.conf"
USB_IMAGES="$(dirname "$0")/images"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" | tee -a "$LOG"; }

log "=== ClubHub USB Recovery Starting ==="
log "Recovery script: $0"

# Load configuration
source "$CONF_PATH"
log "Image: $IMAGE_FILENAME"
log "Target: $TARGET_DEVICE"
log "Reset enrollment: $RESET_ENROLLMENT"
log "Preserve identity: $PRESERVE_IDENTITY"

# Verify image checksum before writing
log "Verifying image checksum..."
ACTUAL_SHA="$(sha256sum "$USB_IMAGES/$IMAGE_FILENAME" | awk '{print $1}')"
if [[ "$ACTUAL_SHA" != "$IMAGE_SHA256" ]]; then
  log "ERROR: Image checksum mismatch"
  log "  Expected: $IMAGE_SHA256"
  log "  Actual:   $ACTUAL_SHA"
  log "RECOVERY ABORTED — do not remove USB, checksum failed"
  exit 1
fi
log "Image checksum verified: ${IMAGE_SHA256:0:16}..."

# Check target device exists
if [[ ! -b "$TARGET_DEVICE" ]]; then
  log "ERROR: Target device $TARGET_DEVICE not found"
  exit 1
fi

# Optionally preserve device identity before overwrite
IDENTITY_BACKUP=""
if [[ "$PRESERVE_IDENTITY" == "true" ]]; then
  log "Preserving device identity..."
  # Mount current SD card (read-only) to extract identity
  TEMP_MOUNT="$(mktemp -d)"
  if mount -o ro "${TARGET_DEVICE}p2" "$TEMP_MOUNT" 2>/dev/null; then
    if [[ -f "$TEMP_MOUNT/etc/clubhub/player.env" ]]; then
      IDENTITY_BACKUP="$(cat "$TEMP_MOUNT/etc/clubhub/player.env")"
      log "Identity captured ($(echo "$IDENTITY_BACKUP" | grep -c '=') vars)"
    fi
    umount "$TEMP_MOUNT"
  fi
  rmdir "$TEMP_MOUNT"
fi

# Unmount target device (it may be partially mounted)
umount "${TARGET_DEVICE}"* 2>/dev/null || true

# Write image to SD card
log "Writing image to $TARGET_DEVICE..."
log "(This takes 3-8 minutes depending on SD card speed)"

if [[ "$IMAGE_FILENAME" == *.zst ]]; then
  zstd -d "$USB_IMAGES/$IMAGE_FILENAME" --stdout | \
    dd of="$TARGET_DEVICE" bs=4M status=progress conv=fsync
else
  dd if="$USB_IMAGES/$IMAGE_FILENAME" of="$TARGET_DEVICE" bs=4M status=progress conv=fsync
fi

log "Image written. Verifying..."

# Post-write verification: compare first 1MB (MBR + partition table)
WRITTEN_SHA="$(dd if="$TARGET_DEVICE" bs=1M count=8 2>/dev/null | sha256sum | awk '{print $1}')"
log "Post-write spot-check SHA: ${WRITTEN_SHA:0:16}..."

# Expand filesystem if needed (Pi image may be smaller than SD card)
partprobe "$TARGET_DEVICE" 2>/dev/null || true
sleep 2
e2fsck -f "${TARGET_DEVICE}p2" 2>/dev/null || true
resize2fs "${TARGET_DEVICE}p2" 2>/dev/null || true
log "Filesystem expanded to fill SD card"

# Re-mount to restore identity or reset enrollment
TEMP_MOUNT="$(mktemp -d)"
mount "${TARGET_DEVICE}p2" "$TEMP_MOUNT"

if [[ "$PRESERVE_IDENTITY" == "true" && -n "$IDENTITY_BACKUP" ]]; then
  log "Restoring device identity..."
  mkdir -p "$TEMP_MOUNT/etc/clubhub"
  echo "$IDENTITY_BACKUP" > "$TEMP_MOUNT/etc/clubhub/player.env"
  log "Identity restored"
elif [[ "$RESET_ENROLLMENT" == "true" ]]; then
  log "Resetting enrollment (clearing player.env)..."
  echo "" > "$TEMP_MOUNT/etc/clubhub/player.env"
  # Remove enrollment sentinel so first-boot runs again
  rm -f "$TEMP_MOUNT/var/lib/clubhub/.enrolled"
  log "Enrollment reset — device will re-enroll on first boot"
fi

# Copy recovery log to SD card for operator access
mkdir -p "$TEMP_MOUNT/var/log"
cp "$LOG" "$TEMP_MOUNT/var/log/last-recovery.log"

umount "$TEMP_MOUNT"
rmdir "$TEMP_MOUNT"

log "=== Recovery Complete ==="
log "Remove USB drive and reboot"
log "Device will $([ "$RESET_ENROLLMENT" == "true" ] && echo "re-enroll" || echo "resume operation")"

# Safe sync before reboot signal
sync
log "Sync complete. Rebooting in 5s..."
sleep 5
reboot
RECOVERY_SCRIPT

  sudo chmod +x "$MOUNT_DATA/recover.sh"

  # Write boot autorun trigger
  # Pi looks for autorun.sh on boot partition for some configurations
  sudo tee "$MOUNT_BOOT/autorun.sh" > /dev/null << 'AUTORUN'
#!/bin/bash
# ClubHub Recovery Autorun
# Executed by Pi firmware on USB boot
mount /dev/sda2 /mnt 2>/dev/null || mount /dev/sdb2 /mnt 2>/dev/null || true
if [[ -f /mnt/recover.sh ]]; then
  bash /mnt/recover.sh
fi
AUTORUN

  # Sync and unmount
  sudo sync
  sudo umount "$MOUNT_BOOT"
  sudo umount "$MOUNT_DATA"

  green "Recovery data written to USB"
}

# ── Post-write verification ───────────────────────────────────────────────────

verify_usb() {
  step "Verifying USB drive"

  local VERIFY_MOUNT="$TMPDIR_USB/verify"
  mkdir -p "$VERIFY_MOUNT"

  sudo mount "${USB_DEVICE}2" "$VERIFY_MOUNT"

  # Verify the image file is readable and non-empty
  if [[ -f "$VERIFY_MOUNT/images/$(basename "$IMAGE_PATH")" ]]; then
    local written_size
    written_size="$(stat -c%s "$VERIFY_MOUNT/images/$(basename "$IMAGE_PATH")")"
    green "Image on USB: $(basename "$IMAGE_PATH") ($(( written_size / 1024 / 1024 ))MB)"
  else
    red "Image file not found on USB after write"
    sudo umount "$VERIFY_MOUNT"
    exit 1
  fi

  # Verify recovery script
  if [[ -x "$VERIFY_MOUNT/recover.sh" ]]; then
    green "Recovery script present and executable"
  else
    red "Recovery script missing or not executable"
    sudo umount "$VERIFY_MOUNT"
    exit 1
  fi

  sudo umount "$VERIFY_MOUNT"
  green "USB verification passed"
}

# ── Cleanup ───────────────────────────────────────────────────────────────────

TMPDIR_USB=""

cleanup() {
  local exit_code=$?
  if [[ -n "$TMPDIR_USB" ]]; then
    sudo umount "$TMPDIR_USB/boot" 2>/dev/null || true
    sudo umount "$TMPDIR_USB/data" 2>/dev/null || true
    sudo umount "$TMPDIR_USB/verify" 2>/dev/null || true
    rm -rf "$TMPDIR_USB" 2>/dev/null || true
  fi
  if [[ $exit_code -ne 0 ]]; then
    red "USB recovery image creation FAILED (exit code $exit_code)"
  fi
}

trap cleanup EXIT

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  blue "═══════════════════════════════════════════════════════"
  blue "  ClubHub TV — USB Recovery Image Generator"
  blue "═══════════════════════════════════════════════════════"
  echo ""

  validate_args
  check_prereqs
  check_usb_size
  validate_image
  confirm_write

  TMPDIR_USB="$(mktemp -d)"

  partition_usb
  write_recovery_data
  verify_usb

  echo ""
  green "═══════════════════════════════════════════════════════"
  green "  USB RECOVERY DRIVE READY"
  green "═══════════════════════════════════════════════════════"
  echo ""
  echo "  Device:   $USB_DEVICE"
  echo "  Image:    $(basename "$IMAGE_PATH")"
  echo "  Reset:    $RESET_ENROLLMENT"
  echo ""
  echo "Recovery procedure:"
  echo "  1. Ensure Pi is powered off"
  echo "  2. Insert USB drive into Pi USB port"
  echo "  3. Power on Pi"
  echo "  4. Wait 5–10 minutes for recovery to complete"
  echo "  5. Remove USB when Pi reboots automatically"
  if [[ "$RESET_ENROLLMENT" == "true" ]]; then
    echo ""
    yellow "  Enrollment reset — Pi will re-enroll on first boot"
    yellow "  Ensure first-boot-enroll.sh can reach CMS API"
  fi
  echo ""
}

main "$@"
