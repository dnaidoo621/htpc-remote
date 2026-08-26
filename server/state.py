import threading
from typing import Callable, Optional


class AppState:
    def __init__(self):
        self._lock = threading.Lock()
        self._client_count = 0
        self._server_url = ""
        self._on_change: list[Callable] = []
        # Setup mode forces the overlay open with a pairing code, proving the
        # person configuring devices can actually see the TV.
        self._setup_code: Optional[str] = None

    def subscribe(self, fn: Callable) -> None:
        self._on_change.append(fn)

    def _notify(self) -> None:
        for fn in self._on_change:
            fn(self)

    @property
    def client_count(self) -> int:
        return self._client_count

    @property
    def server_url(self) -> str:
        return self._server_url

    @server_url.setter
    def server_url(self, value: str) -> None:
        self._server_url = value

    @property
    def setup_code(self) -> Optional[str]:
        return self._setup_code

    @property
    def setup_mode(self) -> bool:
        return self._setup_code is not None

    def start_setup(self, code: str) -> None:
        """Show `code` on the TV so the phone can prove it's in the room."""
        with self._lock:
            self._setup_code = code
        self._notify()

    def end_setup(self) -> None:
        with self._lock:
            self._setup_code = None
        self._notify()

    def client_connected(self) -> None:
        with self._lock:
            self._client_count += 1
        self._notify()

    def client_disconnected(self) -> None:
        with self._lock:
            self._client_count = max(0, self._client_count - 1)
        self._notify()
