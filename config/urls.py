from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def health_check(request):
    return JsonResponse({"status": "ok", "service": "Terminal API"})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def app_config(request):
    """Returns client-side configuration tokens for the mobile app."""
    return Response({
        'success': True,
        'data': {
            'mapbox_access_token': settings.MAPBOX_ACCESS_TOKEN or None,
            'ably_configured': bool(settings.ABLY_API_KEY),
            'storage_configured': bool(settings.AWS_ACCESS_KEY_ID),
        },
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health-check'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/config/', app_config, name='app-config'),
    path('api/v1/auth/', include('accounts.urls.auth')),
    path('api/v1/users/', include('accounts.urls.users')),
    path('api/v1/listings/', include('listings.urls')),
    path('api/v1/search/', include('search.urls')),
    path('api/v1/bookings/', include('bookings.urls')),
    path('api/v1/threads/', include('messaging.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
