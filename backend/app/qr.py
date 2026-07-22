"""تولید تصویر QR کد سفارش به‌صورت base64"""
import base64
from io import BytesIO

import qrcode


def make_qr_base64(text: str) -> str:
    """از متن داده‌شده (کد سفارش) یک PNG می‌سازد و data URI برمی‌گرداند"""
    img = qrcode.make(text, box_size=10, border=2)
    buf = BytesIO()
    img.save(buf)  # فرمت پیش‌فرض PNG است — با همه نسخه‌های qrcode سازگار
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
