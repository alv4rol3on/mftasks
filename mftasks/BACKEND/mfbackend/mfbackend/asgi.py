"""
ASGI config for mfbackend project.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "mfbackend.settings")

application = get_asgi_application()
