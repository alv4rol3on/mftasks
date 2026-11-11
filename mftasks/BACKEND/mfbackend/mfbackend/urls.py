"""
URL configuration for mfbackend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.http import Http404
from django.urls import include, path
from django.conf import settings
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.static import serve as static_serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/tasks/", include("tasks.urls")),
    path("api/usuarios/", include("usuarios.urls")),
    path("api/entidades/", include("clientes.urls")),
    path("api/campanas/", include("campanas.urls")),
]


def servir_descripcion(request, path):
    """Solo expone imágenes inline de descripciones (nombres UUID).

    Los adjuntos de tareas se descargan por el endpoint autenticado
    de la API, nunca por /media.
    """
    if not path.startswith("descripciones/"):
        raise Http404()

    return static_serve(request, path, document_root=settings.MEDIA_ROOT)


urlpatterns += [
    path("media/<path:path>", servir_descripcion),
]

if settings.DEBUG:
    urlpatterns += staticfiles_urlpatterns()
