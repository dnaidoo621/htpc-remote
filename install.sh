#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/htpc-remote"
SERVICE_NAME="htpc-remote"

echo "=== HTPC Remote — Installer ==="
echo "Install dir: $INSTALL_DIR"
echo

# ── 1. System packages ──────────────────────────────────────────────────────
echo "[1/6] Installing system packages…"
sudo apt-get update -qq
sudo apt-get install -y \
  python3 python3-pip python3-venv \
  python3-gi python3-gi-cairo gir1.2-gtk-3.0 \
  libgirepository1.0-dev \
  wtype \
  xdotool \
  libinput-tools

# ── 2. uinput permissions (Wayland / evdev) ─────────────────────────────────
echo "[2/6] Configuring uinput permissions for Wayland support…"
if ! groups | grep -q '\binput\b'; then
  sudo usermod -a -G input "$USER"
  echo "  → Added $USER to 'input' group (logout required for this to take effect)"
else
  echo "  → Already in 'input' group"
fi

UDEV_RULE="/etc/udev/rules.d/99-htpc-remote.rules"
if [ ! -f "$UDEV_RULE" ]; then
  echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
    | sudo tee "$UDEV_RULE" > /dev/null
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  echo "  → udev rule written to $UDEV_RULE"
else
  echo "  → udev rule already exists"
fi

# ── 3. Copy project files ───────────────────────────────────────────────────
echo "[3/6] Copying files to $INSTALL_DIR…"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rsync -a --exclude='.git' --exclude='venv' "$SCRIPT_DIR/" "$INSTALL_DIR/"

# ── 4. Python virtualenv ────────────────────────────────────────────────────
echo "[4/6] Creating Python virtualenv…"
python3 -m venv --system-site-packages "$INSTALL_DIR/venv"
# --system-site-packages lets the venv use the system python3-gi (GTK)
"$INSTALL_DIR/venv/bin/pip" install -q --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

# ── 5. Systemd user service ─────────────────────────────────────────────────
echo "[5/6] Installing systemd user service…"
SERVICE_DIR="$HOME/.config/systemd/user"
mkdir -p "$SERVICE_DIR"
cp "$INSTALL_DIR/systemd/$SERVICE_NAME.service" "$SERVICE_DIR/"
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
systemctl --user start  "$SERVICE_NAME"
echo "  → Service enabled and started"

# ── 6. Done ─────────────────────────────────────────────────────────────────
echo
echo "[6/6] Done."
echo
IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0])")
echo "  Remote URL : http://$IP:8765"
echo "  Service    : systemctl --user status $SERVICE_NAME"
echo "  Logs       : journalctl --user -u $SERVICE_NAME -f"
echo
echo "  If you were just added to the 'input' group, log out and back in"
echo "  to enable full Wayland support, then restart the service:"
echo "    systemctl --user restart $SERVICE_NAME"
