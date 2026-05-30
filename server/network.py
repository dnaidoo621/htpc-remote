import io
import socket

import qrcode
from PIL import Image


def get_local_ip() -> str:
    """Returns the LAN IP that other devices on the same network can reach."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]


def generate_qr_image(url: str, box_size: int = 10, border: int = 2) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGBA")


def generate_qr_bytes(url: str) -> bytes:
    img = generate_qr_image(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
