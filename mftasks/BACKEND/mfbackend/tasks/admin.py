from django.contrib import admin
from .models import Tarea, ArchivoTarea, Subtarea, TareaLog

admin.site.register(Tarea)
admin.site.register(ArchivoTarea)
admin.site.register(Subtarea)
admin.site.register(TareaLog)
