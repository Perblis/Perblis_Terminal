from rest_framework import serializers

from core.file_urls import absolute_file_field, absolute_media_url

from listings.models import Listing


class MapSearchResultSerializer(serializers.ModelSerializer):
    """
    Lightweight listing serializer for map search results.
    Includes distance_km — only present when annotated by the search view.
    """
    distance_km = serializers.SerializerMethodField()
    primary_photo_url = serializers.SerializerMethodField()
    latitude = serializers.ReadOnlyField()
    longitude = serializers.ReadOnlyField()
    owner_name = serializers.SerializerMethodField()
    owner_photo = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            'id', 'resource_type', 'title', 'category',
            'price_daily', 'price_weekly', 'price_monthly',
            'latitude', 'longitude', 'location_address', 'location_city',
            'is_available', 'verification_tier',
            'primary_photo_url', 'distance_km',
            'owner_name', 'owner_photo',
        ]

    def get_distance_km(self, obj):
        if hasattr(obj, 'distance') and obj.distance is not None:
            return round(obj.distance.km, 2)
        return None

    def get_primary_photo_url(self, obj):
        request = self.context.get('request')
        return absolute_media_url(request, obj.primary_photo_url)

    def get_owner_name(self, obj):
        return obj.owner.full_name if obj.owner else None

    def get_owner_photo(self, obj):
        request = self.context.get('request')
        if obj.owner and obj.owner.profile_photo:
            return absolute_file_field(request, obj.owner.profile_photo)
        return None
