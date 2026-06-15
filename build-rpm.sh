#!/usr/bin/env bash
# build-rpm.sh — build htpc-remote-*.rpm via a Fedora Docker container
# Usage: bash build-rpm.sh [version]   default version: 1.0.0
set -euo pipefail

VERSION="${1:-1.0.0}"
PKG_NAME="htpc-remote"
RPM_FILE="${PKG_NAME}-${VERSION}-1.noarch.rpm"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.rpm-build"

echo "=== Building $RPM_FILE ==="

# ── Clean previous build ──────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{SPECS,SOURCES,BUILD,RPMS/noarch,SRPMS}

# ── 1. Pack source tarball (rpmbuild expects name-version.tar.gz) ─────────────
SRCNAME="${PKG_NAME}-${VERSION}"
SRCDIR="$BUILD_DIR/SOURCES/$SRCNAME"
mkdir -p "$SRCDIR"
rsync -a \
    --exclude '.git' \
    --exclude '.deb-build' \
    --exclude '.rpm-build' \
    --exclude 'packaging' \
    --exclude '*.deb' \
    --exclude '*.rpm' \
    --exclude 'venv' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.gitignore' \
    "$SCRIPT_DIR/" "$SRCDIR/"

tar -C "$BUILD_DIR/SOURCES" \
    -czf "$BUILD_DIR/SOURCES/${SRCNAME}.tar.gz" \
    "$SRCNAME"

# ── 2. Stamp version into spec ────────────────────────────────────────────────
sed "s/__VERSION__/${VERSION}/g" \
    "$SCRIPT_DIR/packaging/SPEC/htpc-remote.spec" \
    > "$BUILD_DIR/SPECS/htpc-remote.spec"

# ── 3. Build inside fedora:latest container ───────────────────────────────────
echo ""
echo "Pulling fedora:latest and building .rpm…"
docker run --rm \
    -v "$BUILD_DIR:/rpmbuild" \
    fedora:latest \
    bash -c "
        dnf install -y rpm-build python3 python3-gobject 2>/dev/null
        rpmbuild \
            --define '_topdir /rpmbuild' \
            --define 'dist .fc' \
            -bb /rpmbuild/SPECS/htpc-remote.spec
    "

# ── 4. Move output to project root ────────────────────────────────────────────
RPM_FOUND=$(find "$BUILD_DIR/RPMS" -name "*.rpm" | head -1)
if [ -z "$RPM_FOUND" ]; then
    echo "ERROR: no .rpm found under $BUILD_DIR/RPMS" >&2
    exit 1
fi
cp "$RPM_FOUND" "$SCRIPT_DIR/$RPM_FILE"
rm -rf "$BUILD_DIR"

echo ""
echo "=== Built: $SCRIPT_DIR/$RPM_FILE ==="
echo ""
echo "To deploy:"
echo "  scp $RPM_FILE user@htpc:~/"
echo "  ssh user@htpc 'sudo dnf install ~/$RPM_FILE'"
echo ""
echo "Or one-liner:"
echo "  scp $RPM_FILE user@htpc:~/ && ssh user@htpc 'sudo dnf install ~/\"$RPM_FILE\"'"
