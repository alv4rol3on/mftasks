from rest_framework.exceptions import ValidationError

from ..models import ArchivoTarea


MAX_TOTAL_BYTES = 10 * 1024 * 1024
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_ARCHIVOS = 20

EXTENSIONES_PERMITIDAS = {
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "txt",
    "png",
    "jpg",
    "jpeg",
    "zip",
}

# Firmas reales (magic bytes) por extensión. La extensión y el
# content-type enviados por el cliente no son confiables.
_FIRMAS = {
    "pdf": (b"%PDF-",),
    "doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    "docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
}


def _extension(nombre: str) -> str:
    return nombre.rsplit(".", 1)[-1].lower() if "." in (nombre or "") else ""


def _cabecera(archivo, longitud: int = 8) -> bytes:
    """Lee los primeros bytes del archivo sin dejar el puntero desplazado."""
    posicion = None
    try:
        posicion = archivo.tell()
    except Exception:
        posicion = None

    try:
        archivo.seek(0)
        return archivo.read(longitud) or b""
    finally:
        try:
            archivo.seek(posicion if posicion is not None else 0)
        except Exception:
            pass


def _firma_valida(extension: str, cabecera: bytes) -> bool:
    if extension == "txt":
        # Texto plano: rechazar contenido binario con bytes nulos.
        return b"\x00" not in cabecera

    firmas = _FIRMAS.get(extension)

    if not firmas:
        return False

    return any(cabecera.startswith(firma) for firma in firmas)


def nombre_seguro(nombre: str, defecto: str = "archivo") -> str:
    """Devuelve un nombre sin rutas ni caracteres de control."""
    base = (nombre or "").replace("\\", "/").split("/")[-1]
    base = "".join(
        caracter
        for caracter in base
        if caracter.isprintable() and caracter not in '"\r\n\t'
    )
    base = base.strip().lstrip(".") or defecto
    return base[:255]


def validar_archivos(archivos) -> None:
    """Valida cantidad, tamaño, extensión y firma real de los archivos."""
    archivos = list(archivos or [])

    if not archivos:
        return

    if len(archivos) > MAX_ARCHIVOS:
        raise ValidationError({
            "archivo": (
                f"No puedes adjuntar más de {MAX_ARCHIVOS} archivos a la vez."
            )
        })

    for archivo in archivos:
        if archivo.size > MAX_FILE_BYTES:
            raise ValidationError({
                "archivo": (
                    f"El archivo '{archivo.name}' supera el límite de 10 MB."
                )
            })

        extension = _extension(archivo.name)

        if extension not in EXTENSIONES_PERMITIDAS:
            raise ValidationError({
                "archivo": (
                    f"El formato del archivo '{archivo.name}' no está permitido."
                )
            })

        if not _firma_valida(extension, _cabecera(archivo)):
            raise ValidationError({
                "archivo": (
                    f"El contenido del archivo '{archivo.name}' no coincide "
                    f"con su formato .{extension}."
                )
            })

    if sum(archivo.size for archivo in archivos) > MAX_TOTAL_BYTES:
        raise ValidationError({
            "archivo": "Los archivos adjuntos no pueden superar los 10 MB en total."
        })


def guardar_archivos(tarea, archivos, usuario, informacion_log=None):
    """Crea los registros ArchivoTarea y devuelve la lista creada."""
    creados = []

    for archivo in archivos or []:
        creados.append(
            ArchivoTarea.objects.create(
                tarea=tarea,
                archivo=archivo,
                nombre=nombre_seguro(archivo.name),
                subido_por=usuario,
                informacion_log=informacion_log,
            )
        )

    return creados
