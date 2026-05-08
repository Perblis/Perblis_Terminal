from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from ..serializers import (
    UserProfileSerializer,
    PublicUserSerializer,
    UpdateProfileSerializer,
    UpdateRoleSerializer,
    DocumentUploadSerializer,
)
from ..services import process_document_upload

User = get_user_model()


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user

    if request.method == 'GET':
        from messaging.models import Message
        unread_count = Message.objects.filter(
            thread__participants=user,
            is_read=False,
        ).exclude(sender=user).count()

        serializer = UserProfileSerializer(user)
        data = serializer.data
        data['unread_messages'] = unread_count
        return Response({'success': True, 'data': data})

    serializer = UpdateProfileSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Profile updated.',
        'data': UserProfileSerializer(user).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_role(request):
    user = request.user
    serializer = UpdateRoleSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Role updated.',
        'data': {
            'is_owner': user.is_owner,
            'is_renter': user.is_renter,
        },
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_document(request):
    serializer = DocumentUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    doc = process_document_upload(
        user=request.user,
        document_file=serializer.validated_data['document_file'],
        document_type=serializer.validated_data['document_type'],
    )

    return Response({
        'success': True,
        'message': 'Document uploaded and verified.',
        'data': {
            'id': str(doc.id),
            'document_type': doc.document_type,
            'status': doc.status,
        },
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_profile(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'success': False, 'errors': 'User not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = PublicUserSerializer(user)
    return Response({'success': True, 'data': serializer.data})
