from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(post_save, sender=User)
def create_owner_profile(sender, instance, created, **kwargs):
    """Auto-create an OwnerProfile whenever a user has is_owner=True."""
    if instance.is_owner:
        from .models import OwnerProfile
        OwnerProfile.objects.get_or_create(user=instance)
