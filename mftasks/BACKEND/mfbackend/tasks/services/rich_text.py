import html
import re

import bleach
from django.conf import settings
from django.utils.html import escape


ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "code",
    "pre",
    "a",
    "img",
    "hr",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
}

ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

_TAG_RE = re.compile(r"<\s*[a-zA-Z][^>]*>")
_BLOQUE_RE = re.compile(
    r"<\s*/?\s*(br|p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th)\b[^>]*>",
    re.IGNORECASE,
)


def sanitizar_html(valor):
    """Devuelve HTML seguro usando una lista blanca de etiquetas y atributos."""

    if not valor:
        return ""

    if not contiene_html(valor):
        return str(valor)

    return bleach.clean(
        str(valor),
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )


def contiene_html(valor):
    return bool(valor and _TAG_RE.search(str(valor)))


def html_a_texto(valor):
    """Convierte HTML a texto plano conservando saltos de línea básicos."""

    if not valor:
        return ""

    con_saltos = _BLOQUE_RE.sub("\n", str(valor))
    texto = bleach.clean(
        con_saltos,
        tags=[],
        attributes={},
        protocols=[],
        strip=True,
        strip_comments=True,
    )
    texto = html.unescape(texto)
    texto = re.sub(r"[ \t]+\n", "\n", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip()


def html_para_correo(valor):
    """HTML listo para insertar en correos, con soporte para texto legado."""

    if not valor:
        return ""

    valor = str(valor)

    if not contiene_html(valor):
        return escape(valor).replace("\n", "<br>")

    limpiado = sanitizar_html(valor)
    base = (getattr(settings, "MF_BACKEND_URL", "") or "").rstrip("/")

    if not base:
        return limpiado

    return re.sub(
        r'(src|href)="(/media/)',
        lambda match: f'{match.group(1)}="{base}{match.group(2)}',
        limpiado,
    )
