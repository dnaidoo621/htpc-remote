#!/usr/bin/env bash
# build-deb.sh — build htpc-remote_*.deb via a Debian Docker container
# Usage: bash build-deb.sh [version]   default version: 1.0.0
set -euo pipefail

VERSION="${1:-1.0.0}"
PKG_NAME="htpc-remote"
DEB_NAME="${PKG_NAME}_${VERSION}_all.deb"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.deb-build"
PKG_ROOT="$BUILD_DIR/pkg"

echo "=== Building $DEB_NAME ==="

# ── Clean previous build ──────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"
mkdir -p "$PKG_ROOT"

# ── 1. DEBIAN control files ───────────────────────────────────────────────────
cp -r "$SCRIPT_DIR/packaging/DEBIAN" "$PKG_ROOT/DEBIAN"
# Stamp the version into the control file
sed -i.bak "s/^Version:.*/Version: $VERSION/" "$PKG_ROOT/DEBIAN/control" && rm -f "$PKG_ROOT/DEBIAN/control.bak"
chmod 755 "$PKG_ROOT/DEBIAN/postinst" \
           "$PKG_ROOT/DEBIAN/prerm" \
           "$PKG_ROOT/DEBIAN/postrm"

# ── 2. Application files → /opt/htpc-remote ───────────────────────────────────
APP_DEST="$PKG_ROOT/opt/$PKG_NAME"
mkdir -p "$APP_DEST"
rsync -a \
    --exclude='.git' \
    --exclude='.deb-build' \
    --exclude='packaging' \
    --exclude='build-deb.sh' \
    --exclude='*.deb' \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.gitignore' \
    "$SCRIPT_DIR/" "$APP_DEST/"

# ── 3. Systemd user service → /usr/lib/systemd/user ──────────────────────────
SERVICE_DEST="$PKG_ROOT/usr/lib/systemd/user"
mkdir -p "$SERVICE_DEST"
cat > "$SERVICE_DEST/htpc-remote.service" <<'SERVICE'
[Unit]
Description=HTPC Remote Control Server (Glide)
Documentation=https://github.com/dnaidoo621/htpc-remote
After=network-online.target graphical-session.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/htpc-remote
ExecStart=/opt/htpc-remote/venv/bin/python /opt/htpc-remote/run.py
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=default.target
SERVICE

# ── 4. udev rule → /etc/udev/rules.d ─────────────────────────────────────────
UDEV_DEST="$PKG_ROOT/etc/udev/rules.d"
mkdir -p "$UDEV_DEST"
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
    > "$UDEV_DEST/99-htpc-remote.rules"

# ── 5. Fix permissions ────────────────────────────────────────────────────────
find "$PKG_ROOT" -type d -exec chmod 755 {} \;
find "$PKG_ROOT/opt" -type f -exec chmod 644 {} \;
chmod 755 "$PKG_ROOT/opt/$PKG_NAME/run.py"
chmod 755 "$PKG_ROOT/opt/$PKG_NAME/install.sh" 2>/dev/null || true

# ── 6. Build with dpkg-deb inside a Debian container ─────────────────────────
echo ""
echo "Pulling debian:bookworm-slim and building .deb…"
docker run --rm \
    -v "$BUILD_DIR:/build" \
    debian:bookworm-slim \
    dpkg-deb --root-owner-group --build /build/pkg "/build/$DEB_NAME"

# ── 7. Move output to project root ───────────────────────────────────────────
mv "$BUILD_DIR/$DEB_NAME" "$SCRIPT_DIR/$DEB_NAME"
rm -rf "$BUILD_DIR"

echo ""
echo "=== Built: $SCRIPT_DIR/$DEB_NAME ==="
echo ""
echo "To deploy:"
echo "  scp $DEB_NAME user@htpc:~/"
echo "  ssh user@htpc 'sudo apt install -y ./$DEB_NAME'"
echo ""
echo "Or one-liner:"
echo "  scp $DEB_NAME user@htpc:~/ && ssh user@htpc 'sudo apt install -y ~/$DEB_NAME'"
