import shutil
import subprocess
from abc import ABC, abstractmethod

# Common HTPC app launch commands.
# Each value can be a string (shell command) or list (tried in order, first found wins).
APP_COMMANDS: dict[str, str | list[str]] = {
    "jellyfin": "xdg-open http://localhost:8096",
    "plex":     "xdg-open https://app.plex.tv",
    "kodi":     ["kodi", "flatpak run tv.kodi.Kodi"],
    "netflix":  "xdg-open https://www.netflix.com",
    "youtube":  "xdg-open https://www.youtube.com",
    "spotify":  ["spotify", "flatpak run com.spotify.Client"],
    "browser":  ["xdg-open https://", "firefox", "chromium-browser", "google-chrome"],
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
        """Launch an app by name. Shared implementation for all backends."""
        cmd = APP_COMMANDS.get(name.lower())
        if not cmd:
            return
        candidates = [cmd] if isinstance(cmd, str) else cmd
        for c in candidates:
            exe = c.split()[0]
            # xdg-open always exists; other commands need a which-check
            if exe == "xdg-open" or shutil.which(exe):
                subprocess.Popen(c, shell=True, start_new_session=True)
                return

    def cleanup(self) -> None:
        pass
