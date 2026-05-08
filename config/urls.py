from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok", "service": "Terminal API"})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health-check'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/auth/', include('accounts.urls.auth')),
    path('api/v1/users/', include('accounts.urls.users')),
    path('api/v1/listings/', include('listings.urls')),
    path('api/v1/search/', include('search.urls')),
    path('api/v1/bookings/', include('bookings.urls')),
    path('api/v1/threads/', include('messaging.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
