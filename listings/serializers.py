from rest_framework import serializers
from django.contrib.gis.geos import Point

from core.file_urls import absolute_file_field

from .models import Listing, ListingMedia, ListingReport, ResourceType


class ListingMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ListingMedia
        fields = ['id', 'file_url', 'is_primary', 'display_order', 'created_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        return absolute_file_field(request, obj.file)


class ListingOwnerSerializer(serializers.Serializer):
    """Minimal owner info embedded in listing responses."""
    id = serializers.UUIDField()
    full_name = serializers.CharField()
    profile_photo = serializers.SerializerMethodField()
    verification_level = serializers.IntegerField()

    def get_profile_photo(self, obj):
        request = self.context.get('request')
        return absolute_file_field(request, obj.profile_photo)


class ListingSerializer(serializers.ModelSerializer):
    """Full listing detail — used for detail and owner list views."""
    owner = ListingOwnerSerializer(read_only=True)
    media = ListingMediaSerializer(many=True, read_only=True)
    primary_photo_url = serializers.SerializerMethodField()
    latitude = serializers.ReadOnlyField()
    longitude = serializers.ReadOnlyField()

    class Meta:
        model = Listing
        fields = [
            'id', 'owner', 'resource_type', 'title', 'description', 'category',
            'price_daily', 'price_weekly', 'price_monthly', 'specs',
            'latitude', 'longitude', 'location_address', 'location_city',
            'operator_available', 'delivery_available',
            'status', 'is_available', 'verification_tier',
            'view_count', 'primary_photo_url', 'media',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'verification_tier', 'view_count', 'created_at', 'updated_at']

    def get_primary_photo_url(self, obj):
        request = self.context.get('request')
        primary = obj.media.filter(is_primary=True).first()
        if primary:
            return absolute_file_field(request, primary.file)
        first = obj.media.first()
        if first:
            return absolute_file_field(request, first.file)
        return None


class CreateListingSerializer(serializers.ModelSerializer):
    """Used for creating and updating listings."""
    latitude = serializers.FloatField(write_only=True, required=False, allow_null=True)
    longitude = serializers.FloatField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Listing
        fields = [
            'resource_type', 'title', 'description', 'category',
            'price_daily', 'price_weekly', 'price_monthly', 'specs',
            'latitude', 'longitude', 'location_address', 'location_city',
            'operator_available', 'delivery_available',
        ]

    def validate(self, attrs):
        lat = attrs.pop('latitude', None)
        lng = attrs.pop('longitude', None)

        if lat is not None and lng is not None:
            attrs['location'] = Point(lng, lat, srid=4326)

        return attrs

    def validate_resource_type(self, value):
        if value not in [choice[0] for choice in ResourceType.choices]:
            raise serializers.ValidationError(f"Invalid resource type: {value}")
        return value


class UpdateListingStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = ['status']

    def validate_status(self, value):
        instance = self.instance
        if value == 'active' and not instance.location:
            raise serializers.ValidationError(
                'A listing must have a location set before it can be published.'
            )
        if value == 'active' and not instance.media.exists():
            raise serializers.ValidationError(
                'A listing must have at least one photo before it can be published.'
            )
        return value


class ListingReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingReport
        fields = ['reason', 'description']
