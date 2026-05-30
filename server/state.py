import threading
from typing import Callable


class AppState:
    def __init__(self):
        self._lock = threading.Lock()
        self._client_count = 0
        self._server_url = ""
        self._on_change: list[Callable] = []

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

    def client_connected(self) -> None:
        with self._lock:
            self._client_count += 1
        self._notify()

    def client_disconnected(self) -> None:
        with self._lock:
            self._client_count = max(0, self._client_count - 1)
        self._notify()
