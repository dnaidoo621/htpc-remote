#!/usr/bin/env bash
# install.sh — Glide HTPC Remote installer for Linux
# Supports: Debian/Ubuntu (apt), Fedora/RHEL (dnf), Arch/Manjaro (pacman), openSUSE (zypper)
# Usage: bash install.sh
set -euo pipefail

INSTALL_DIR="$HOME/htpc-remote"
SERVICE_NAME="htpc-remote"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Glide HTPC Remote — Linux Installer ==="
echo "Install dir : $INSTALL_DIR"
echo

# ── 1. Detect package manager and install system packages ───────────────────
echo "[1/6] Installing system packages…"

if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y \
        python3 python3-pip python3-venv \
        python3-gi python3-gi-cairo gir1.2-gtk-3.0 \
        libgirepository1.0-dev \
        xdotool wtype brightnessctl

elif command -v dnf &>/dev/null; then
    sudo dnf install -y \
        python3 python3-pip \
        python3-gobject python3-gobject-devel gtk3 \
        gobject-introspection-devel \
        xdotool wtype brightnessctl

elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm \
        python python-pip \
        python-gobject gtk3 \
        gobject-introspection \
        xdotool wtype brightnessctl

elif command -v zypper &>/dev/null; then
    sudo zypper install -y \
        python3 python3-pip \
        python3-gobject typelib-1_0-Gtk-3_0 \
        gobject-introspection-devel \
        xdotool wtype brightnessctl

else
    echo "ERROR: No supported package manager found (apt / dnf / pacman / zypper)"
    echo "Please install the following manually and re-run:"
    echo "  python3, python3-pip, python3-gobject, gtk3, xdotool, wtype"
    exit 1
fi

# ── 2. uinput permissions (Wayland / evdev) ─────────────────────────────────
echo "[2/6] Configuring uinput permissions for Wayland support…"
if ! groups | grep -q '\binput\b'; then
    sudo usermod -a -G input "$USER"
    echo "  → Added $USER to 'input' group (logout required for full Wayland support)"
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
rsync -a --exclude='.git' --exclude='venv' --exclude='*.deb' "$SCRIPT_DIR/" "$INSTALL_DIR/"

# ── 4. Python virtualenv ────────────────────────────────────────────────────
echo "[4/6] Creating Python virtualenv…"
# --system-site-packages lets the venv find system-installed python3-gi (GTK)
python3 -m venv --system-site-packages "$INSTALL_DIR/venv"
"$INSTALL_DIR/venv/bin/pip" install -q --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install -q -r "$INSTALL_DIR/requirements.txt"

# ── 5. Systemd user service ─────────────────────────────────────────────────
echo "[5/6] Installing systemd user service…"
SERVICE_DIR="$HOME/.config/systemd/user"
mkdir -p "$SERVICE_DIR"
cp "$INSTALL_DIR/systemd/$SERVICE_NAME.service" "$SERVICE_DIR/"
systemctl --user daemon-reload
systemctl --user enable  "$SERVICE_NAME"
systemctl --user restart "$SERVICE_NAME"
echo "  → Service enabled and started"

# ── 6. Done ─────────────────────────────────────────────────────────────────
echo
echo "[6/6] Done."
echo
IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0])")
echo "  Remote URL : http://$IP:8765"
echo "  Status     : systemctl --user status $SERVICE_NAME"
echo "  Logs       : journalctl --user -u $SERVICE_NAME -f"
echo
if ! groups | grep -q '\binput\b'; then
    echo "  NOTE: Log out and back in to activate full Wayland support, then:"
    echo "        systemctl --user restart $SERVICE_NAME"
fi
