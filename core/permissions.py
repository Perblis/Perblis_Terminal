from rest_framework.permissions import BasePermission


class IsOwnerRole(BasePermission):
    """Allows access only to users who have the owner role enabled."""
    message = 'You must enable the owner role to perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_owner)


class IsRenterRole(BasePermission):
    """Allows access only to users who have the renter role enabled."""
    message = 'You must enable the renter role to perform this action.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_renter)


class IsObjectOwner(BasePermission):
    """Allows access only to the owner of the specific object."""
    message = 'You do not have permission to modify this object.'

    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user
