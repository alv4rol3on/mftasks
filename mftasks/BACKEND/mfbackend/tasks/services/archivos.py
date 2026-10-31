from rest_framework.exceptions import ValidationError

from ..models import ArchivoTarea


MAX_TOTAL_BYTES = 10 * 1024 * 1024
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


def _extension(nombre: str) -> str:
    return nombre.rsplit(".", 1)[-1].lower() if "." in (nombre or "") else ""


def validar_archivos(archivos) -> None:
    """Valida cantidad, tamaño total y extensiones permitidas."""
    archivos = list(archivos or [])
    if not archivos:
        return

    if sum(archivo.size for archivo in archivos) > MAX_TOTAL_BYTES:
        raise ValidationError({
            "archivo": "Los archivos adjuntos no pueden superar los 10 MB en total."
        })

    for archivo in archivos:
        if _extension(archivo.name) not in EXTENSIONES_PERMITIDAS:
            raise ValidationError({
                "archivo": (
                    f"El formato del archivo '{archivo.name}' no está permitido."
                )
            })


def guardar_archivos(tarea, archivos, usuario, informacion_log=None):
    """Crea los registros ArchivoTarea y devuelve la lista creada."""
    creados = []
    for archivo in archivos or []:
        creados.append(
            ArchivoTarea.objects.create(
                tarea=tarea,
                archivo=archivo,
                nombre=archivo.name,
                subido_por=usuario,
                informacion_log=informacion_log,
            )
        )
    return creados
