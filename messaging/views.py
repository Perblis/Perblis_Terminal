from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from listings.models import Listing
from .models import Thread, Message
from .serializers import (
    ThreadSerializer,
    MessageSerializer,
    SendMessageSerializer,
    CreateInquiryThreadSerializer,
)
from .services import (
    get_or_create_inquiry_thread,
    publish_to_ably,
    get_ably_token,
)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def thread_list_create(request):
    """
    GET: List all threads the user is a participant in.
    POST: Start an inquiry thread from a listing page.
    """
    if request.method == 'GET':
        threads = (
            Thread.objects
            .filter(participants=request.user)
            .prefetch_related('participants', 'messages')
            .select_related('listing', 'booking')
            .order_by('-updated_at')
        )
        serializer = ThreadSerializer(threads, many=True, context={'request': request})
        return Response({'success': True, 'data': serializer.data})

    # POST — start an inquiry thread
    serializer = CreateInquiryThreadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    listing_id = serializer.validated_data['listing_id']
    initial_message = serializer.validated_data['initial_message']

    listing = get_object_or_404(Listing, id=listing_id, status='active')

    # Cannot message yourself
    if listing.owner == request.user:
        return Response(
            {'success': False, 'errors': 'You cannot send an inquiry to your own listing.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    thread, created = get_or_create_inquiry_thread(listing, request.user)

    # Send the initial message
    message = Message.objects.create(
        thread=thread,
        sender=request.user,
        body=initial_message,
    )

    # Update thread's updated_at
    Thread.objects.filter(id=thread.id).update(updated_at=message.created_at)

    # Publish to Ably
    publish_to_ably(str(thread.id), {
        'id': str(message.id),
        'body': message.body,
        'sender_id': str(message.sender.id),
        'sender_name': message.sender.full_name,
        'created_at': message.created_at.isoformat(),
    })

    return Response({
        'success': True,
        'data': ThreadSerializer(thread, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def thread_detail(request, thread_id):
    """
    Get thread detail with all messages.
    Auto-marks messages from the other party as read.
    """
    thread = get_object_or_404(
        Thread.objects.prefetch_related('participants', 'messages__sender')
        .select_related('listing', 'booking'),
        id=thread_id,
        participants=request.user,
    )

    # Mark messages from others as read
    Message.objects.filter(
        thread=thread,
        is_read=False,
    ).exclude(sender=request.user).update(is_read=True)

    messages = thread.messages.all()
    message_serializer = MessageSerializer(messages, many=True, context={'request': request})
    thread_serializer = ThreadSerializer(thread, context={'request': request})

    return Response({
        'success': True,
        'thread': thread_serializer.data,
        'messages': message_serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, thread_id):
    """Send a message in a thread."""
    thread = get_object_or_404(
        Thread,
        id=thread_id,
        participants=request.user,
    )

    serializer = SendMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    message = Message.objects.create(
        thread=thread,
        sender=request.user,
        body=serializer.validated_data['body'],
    )

    # Update thread's updated_at
    Thread.objects.filter(id=thread.id).update(updated_at=timezone.now())

    # Publish to Ably for real-time delivery
    publish_to_ably(str(thread.id), {
        'id': str(message.id),
        'body': message.body,
        'sender_id': str(message.sender.id),
        'sender_name': message.sender.full_name,
        'created_at': message.created_at.isoformat(),
    })

    return Response({
        'success': True,
        'data': MessageSerializer(message, context={'request': request}).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_messaging_token(request):
    """Get an Ably authentication token scoped to this user's threads."""
    token = get_ably_token(request.user)

    if token is None:
        return Response({
            'success': False,
            'errors': 'Real-time messaging is not configured. Check ABLY_API_KEY.',
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    return Response({'success': True, 'token': token})
