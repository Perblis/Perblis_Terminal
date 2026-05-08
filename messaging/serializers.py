from rest_framework import serializers
from django.contrib.auth import get_user_model

from .models import Thread, Message

User = get_user_model()


class MessageSenderSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'profile_photo']


class MessageSerializer(serializers.ModelSerializer):
    sender = MessageSenderSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'body', 'is_read', 'created_at']
        read_only_fields = ['id', 'sender', 'is_read', 'created_at']


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(required=True, allow_blank=False)


class ThreadSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    listing_title = serializers.CharField(source='listing.title', read_only=True, default=None)
    booking_id = serializers.UUIDField(source='booking.id', read_only=True, default=None)
    is_booking_thread = serializers.ReadOnlyField()

    class Meta:
        model = Thread
        fields = [
            'id', 'is_booking_thread', 'booking_id', 'listing_title',
            'other_participant', 'last_message', 'unread_count',
            'created_at', 'updated_at',
        ]

    def get_other_participant(self, obj):
        request = self.context.get('request')
        if request:
            other = obj.get_other_participant(request.user)
            if other:
                return {
                    'id': str(other.id),
                    'full_name': other.full_name,
                    'profile_photo': request.build_absolute_uri(other.profile_photo.url) if other.profile_photo else None,
                }
        return None

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return {
                'body': last.body[:100],
                'sender_name': last.sender.full_name,
                'created_at': last.created_at,
            }
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0


class CreateInquiryThreadSerializer(serializers.Serializer):
    listing_id = serializers.UUIDField(required=True)
    initial_message = serializers.CharField(required=True, allow_blank=False)
