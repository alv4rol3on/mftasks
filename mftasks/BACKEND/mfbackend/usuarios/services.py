from django.shortcuts import get_object_or_404

from .models import User


class UserService:

    @staticmethod
    def list():
        return User.objects.prefetch_related(
            "roles"
        ).all()

    @staticmethod
    def get(pk):

        return get_object_or_404(
            User.objects.prefetch_related("roles"),
            pk=pk
        )

    @staticmethod
    def create(serializer):

        return serializer.save()

    @staticmethod
    def update(serializer):

        return serializer.save()

    @staticmethod
    def deactivate(user):

        user.activo = False
        user.save()

        return user