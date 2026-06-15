Name:           htpc-remote
Version:        __VERSION__
Release:        1%{?dist}
Summary:        Self-hosted HTPC remote control via phone browser (Glide)
License:        MIT
URL:            https://github.com/dnaidoo621/htpc-remote
BuildArch:      noarch
Source0:        %{name}-%{version}.tar.gz

# Skip Python byte-compilation during the build — we do that at install time
# inside the venv instead.
%define _python_bytecompile_extra 0
%define _python_bytecompile_errors_terminate_build 0

%description
Glide turns any phone into a polished HTPC remote. Scan a QR code that
appears on your TV/monitor, and any mobile browser on the same network
becomes a trackpad, media controller, D-pad, app launcher, and keyboard.

Supports X11 (pynput) and Wayland (evdev/uinput). Runs as a systemd user
service that starts automatically on login.

%prep
%setup -q

%install
rm -rf %{buildroot}

# ── App files → /opt/htpc-remote ──────────────────────────────────────────
install -dm 755 %{buildroot}/opt/%{name}
cp -a . %{buildroot}/opt/%{name}/

# Clean up items that don't belong in the installed tree
rm -rf  %{buildroot}/opt/%{name}/packaging
rm -rf  %{buildroot}/opt/%{name}/systemd
rm -rf  %{buildroot}/opt/%{name}/docs
rm -f   %{buildroot}/opt/%{name}/build-deb.sh
rm -f   %{buildroot}/opt/%{name}/build-rpm.sh
rm -f   %{buildroot}/opt/%{name}/*.deb
rm -f   %{buildroot}/opt/%{name}/*.rpm

# Fix permissions: directories 755, files 644, entry-point 755
find %{buildroot}/opt/%{name} -type d -exec chmod 755 {} \;
find %{buildroot}/opt/%{name} -type f -exec chmod 644 {} \;
chmod 755 %{buildroot}/opt/%{name}/run.py
chmod 755 %{buildroot}/opt/%{name}/install.sh
chmod 755 %{buildroot}/opt/%{name}/install-windows.ps1

# ── Systemd user service → /usr/lib/systemd/user ──────────────────────────
install -dm 755 %{buildroot}/usr/lib/systemd/user
cat > %{buildroot}/usr/lib/systemd/user/%{name}.service << 'SERVICE'
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

# ── udev rule → /etc/udev/rules.d ─────────────────────────────────────────
install -dm 755 %{buildroot}/etc/udev/rules.d
echo 'KERNEL=="uinput", GROUP="input", MODE="0660", OPTIONS+="static_node=uinput"' \
    > %{buildroot}/etc/udev/rules.d/99-%{name}.rules

%files
%defattr(644, root, root, 755)
/opt/%{name}
/usr/lib/systemd/user/%{name}.service
/etc/udev/rules.d/99-%{name}.rules

# ── Post-install ─────────────────────────────────────────────────────────────
%post
set -e
APP_DIR=/opt/%{name}
VENV="$APP_DIR/venv"

echo "=== htpc-remote: post-install ==="

# 1. Python virtualenv — system-site-packages lets it find python3-gobject/GTK
echo "[1/4] Creating Python virtualenv..."
python3 -m venv --system-site-packages "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q -r "$APP_DIR/requirements.txt"

# 2. Detect the graphical user
echo "[2/4] Detecting logged-in user..."
REAL_USER=""
REAL_USER=$(who 2>/dev/null | awk '/:0/{print $1; exit}')
[ -z "$REAL_USER" ] && \
    REAL_USER=$(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $3; exit}')
[ -z "$REAL_USER" ] && REAL_USER=$(ls /home 2>/dev/null | head -1)
echo "  Detected user: ${REAL_USER:-unknown}"

# 3. Add user to 'input' group (Wayland/uinput support)
echo "[3/4] Configuring input permissions..."
if [ -n "$REAL_USER" ] && ! groups "$REAL_USER" 2>/dev/null | grep -q '\binput\b'; then
    usermod -a -G input "$REAL_USER" || true
    echo "  → Added $REAL_USER to 'input' group"
fi
udevadm control --reload-rules 2>/dev/null || true
udevadm trigger            2>/dev/null || true

# 4. Enable + start the systemd user service
echo "[4/4] Enabling systemd user service..."
systemctl --user --global enable %{name}.service 2>/dev/null || true

if [ -n "$REAL_USER" ]; then
    USER_UID=$(id -u "$REAL_USER" 2>/dev/null || true)
    if [ -n "$USER_UID" ] && [ -d "/run/user/$USER_UID" ]; then
        su -l "$REAL_USER" -c \
            "XDG_RUNTIME_DIR=/run/user/$USER_UID \
             systemctl --user daemon-reload && \
             XDG_RUNTIME_DIR=/run/user/$USER_UID \
             systemctl --user restart %{name}.service" \
            2>/dev/null || true
    fi
fi

echo ""
echo "  Glide HTPC Remote is installed."
echo "  On next login a QR popup will appear. Scan it to connect."
echo ""
echo "  Logs:   journalctl --user -u %{name} -f"
echo "  Status: systemctl --user status %{name}"

# ── Pre-uninstall ─────────────────────────────────────────────────────────────
%preun
if [ $1 -eq 0 ]; then
    systemctl --user --global disable %{name}.service 2>/dev/null || true

    REAL_USER=""
    REAL_USER=$(who 2>/dev/null | awk '/:0/{print $1; exit}')
    [ -z "$REAL_USER" ] && \
        REAL_USER=$(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $3; exit}')

    if [ -n "$REAL_USER" ]; then
        USER_UID=$(id -u "$REAL_USER" 2>/dev/null || true)
        if [ -n "$USER_UID" ] && [ -d "/run/user/$USER_UID" ]; then
            su -l "$REAL_USER" -c \
                "XDG_RUNTIME_DIR=/run/user/$USER_UID \
                 systemctl --user stop %{name}.service" \
                2>/dev/null || true
        fi
    fi
fi

# ── Post-uninstall ────────────────────────────────────────────────────────────
%postun
if [ $1 -eq 0 ]; then
    rm -rf /opt/%{name}/venv
    udevadm control --reload-rules 2>/dev/null || true
fi
