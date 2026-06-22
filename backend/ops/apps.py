from django.apps import AppConfig


class OpsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ops"

    def ready(self) -> None:
        # Connect the Ops Console security-logging receivers (TSD §7).
        from . import signals  # noqa: F401
