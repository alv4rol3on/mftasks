from django.db import migrations
import random

# Datos extraídos de csc.xlsx (65 filas, 13 campañas)
# Corrección de encoding: Híbrido, Préstamos, Protección, etc.
CSC_DATA = {
    "BBVA": ["Tarjetas Out", "Tarjetas Híbrido", "Portafolio Out", "Operaciones Out", "Préstamos Híbrido", "Préstamos Out", "Operaciones Híbrido", "Tarjetas Start"],
    "Scotiabank": ["Tarjetas Out"],
    "Grupo EFE": ["Fonocompras", "Recurrente", "Dormidos", "Nuevos", "Inbound", "Financiera Efectiva", "Outbound"],
    "Davivienda Panamá": ["Davivienda", "Unicef", "Préstamos"],
    "Unicef": ["Digital", "Retenciones"],
    "Banbif": ["Préstamos Libre de Disposición"],
    "Oncosalud": ["Convenios"],
    "BBVA Convenios": ["Nacional", "Lima", "Trujillo", "Chiclayo", "Huaraz", "Iquitos", "Cajamarca", "Puno", "Tarapoto", "Norte Chico", "Lima Call", "Arequipa", "Apurimac", "Pucallpa", "Ica", "Tacna"],
    "Unicef Retenciones": ["Upgrade Circulo", "Upgrade Linea", "Reactivación", "Saving", "Extracash", "Gracias", "Inbound"],
    "BBVA Seguros": ["Protección Múltiple", "Renta Hospitalaria", "RH ALTAS", "PM ALTAS"],
    "BCP Convenios": ["Protección Múltiple", "Renta Hospitalaria", "RH ALTAS", "PM ALTAS"],
    "Scotiabank convenios": ["Nacional", "Lima", "Trujillo", "Chiclayo", "Iquitos", "Lima Call", "Huancayo", "Call Provincia", "Pucallpa"],
    "Diners": ["TC"],
}


def seed_csc(apps, schema_editor):
    Cliente = apps.get_model("clientes", "Cliente")
    Campana = apps.get_model("campanas", "Campana")
    SubCampana = apps.get_model("campanas", "SubCampana")

    for campana_nombre, subs in CSC_DATA.items():
        # Cliente
        cliente, _ = Cliente.objects.get_or_create(
            nombre=campana_nombre,
            defaults={"razon_social": campana_nombre, "activo": True, "correo": "", "telefono": "", "direccion": ""},
        )
        # Campana
        campana, _ = Campana.objects.get_or_create(
            cliente=cliente,
            nombre=campana_nombre,
            defaults={"codigo": campana_nombre[:30].upper().replace(" ", "_")[:30], "activo": True},
        )
        # asegurar codigo
        if not campana.codigo:
            campana.codigo = campana_nombre[:30].upper().replace(" ", "_")[:30]
            campana.save(update_fields=["codigo"])
        for sub in subs:
            codigo = f"{campana.codigo}_{sub[:15].upper().replace(' ', '_')}"[:40]
            # normalizar
            codigo = codigo.replace("Í", "I").replace("Á", "A").replace("É", "E").replace("Ó", "O").replace("Ú", "U")
            # Manejar colisión de codigo único (get_or_create por campana+nombre, pero codigo debe ser único global)
            try:
                SubCampana.objects.get_or_create(
                    campana=campana,
                    nombre=sub,
                    defaults={"codigo": codigo, "activo": True},
                )
            except Exception as e:
                if "UNIQUE constraint failed" in str(e) and "codigo" in str(e):
                    # generar alternativo con sufijo random
                    for _ in range(5):
                        alt = f"{codigo[:35]}_{random.randint(1000,9999)}"[:40]
                        try:
                            SubCampana.objects.get_or_create(
                                campana=campana,
                                nombre=sub,
                                defaults={"codigo": alt, "activo": True},
                            )
                            break
                        except Exception:
                            continue
                    else:
                        raise
                else:
                    raise


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("campanas", "0002_seed_bbva"),
        ("clientes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_csc, unseed),
    ]
