import os
import shutil
import subprocess
import sys
from abc import ABC, abstractmethod

# Linux app launch commands (xdg-open / flatpak).
APP_COMMANDS: dict[str, str | list[str]] = {
    "jellyfin": "xdg-open http://localhost:8096",
    "plex":     "xdg-open https://app.plex.tv",
    "kodi":     ["kodi", "flatpak run tv.kodi.Kodi"],
    "netflix":  "xdg-open https://www.netflix.com",
    "youtube":  "xdg-open https://www.youtube.com",
    "spotify":  ["spotify", "flatpak run com.spotify.Client"],
    "browser":  ["firefox", "chromium-browser", "google-chrome", "xdg-open https://"],
}

# Windows app launch commands.  URLs are passed to os.startfile(); executable
# names are searched with shutil.which() first.
APP_COMMANDS_WIN: dict[str, str | list[str]] = {
    "jellyfin": "http://localhost:8096",
    "plex":     "https://app.plex.tv",
    "kodi":     ["kodi.exe", "kodi"],
    "netflix":  "https://www.netflix.com",
    "youtube":  "https://www.youtube.com",
    "spotify":  ["spotify.exe", "spotify:", "https://open.spotify.com"],
    "browser":  ["msedge.exe", "chrome.exe", "firefox.exe", "https://"],
}


class InputBackend(ABC):

    @abstractmethod
    def move_mouse(self, dx: float, dy: float) -> None: ...

    @abstractmethod
    def click(self, button: str) -> None: ...  # 'left' | 'right' | 'middle'

    @abstractmethod
    def scroll(self, dy: float) -> None: ...  # positive = scroll down

    @abstractmethod
    def type_text(self, text: str) -> None: ...

    @abstractmethod
    def press_key(self, key: str) -> None: ...

    def launch_app(self, name: str) -> None:
        if sys.platform == "win32":
            self._launch_app_win(name)
        else:
            self._launch_app_linux(name)

    def _launch_app_linux(self, name: str) -> None:
        cmd = APP_COMMANDS.get(name.lower())
        if not cmd:
            return
        candidates = [cmd] if isinstance(cmd, str) else cmd
        for c in candidates:
            exe = c.split()[0]
            if exe == "xdg-open" or shutil.which(exe):
                subprocess.Popen(c, shell=True, start_new_session=True)
                return

    def _launch_app_win(self, name: str) -> None:
        cmd = APP_COMMANDS_WIN.get(name.lower())
        if not cmd:
            return
        candidates = [cmd] if isinstance(cmd, str) else cmd
        for c in candidates:
            # URL — hand off to the default browser/handler
            if c.startswith("http://") or c.startswith("https://") or ":" in c[:10]:
                os.startfile(c)
                return
            # Executable — verify it exists first
            if shutil.which(c.split()[0]):
                subprocess.Popen(c, start_new_session=True)
                return

    def cleanup(self) -> None:
        pass
