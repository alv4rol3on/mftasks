from django.apps import AppConfig


class TasksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tasks'

    def ready(self):
        import os
        import sys
        # no iniciar en migrate/collectstatic/shell/test
        if any(cmd in sys.argv for cmd in ("migrate", "collectstatic", "makemigrations", "shell", "test")):
            return
        # runserver autoreload lanza 2 procesos; solo el principal (RUN_MAIN=true) inicia scheduler
        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return
        try:
            from .scheduler import start_scheduler
            start_scheduler()
        except Exception:
            pass
