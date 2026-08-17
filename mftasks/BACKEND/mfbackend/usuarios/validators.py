from rest_framework import serializers

from .models import User


def validate_email(email):

    if User.objects.filter(email=email).exists():
        raise serializers.ValidationError(
            "Ya existe un usuario con este correo."
        )

    return email