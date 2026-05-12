import pytest
from django.contrib.gis.geos import Point
from listings.models import Listing


@pytest.mark.django_db
class TestMapSearch:
    URL = '/api/v1/search/map/'
    LAGOS_LAT = 6.5244
    LAGOS_LNG = 3.3792

    def test_requires_lat_and_lng(self, api_client):
        response = api_client.get(self.URL)
        assert response.status_code == 400

    def test_requires_lat(self, api_client):
        response = api_client.get(f'{self.URL}?lng={self.LAGOS_LNG}')
        assert response.status_code == 400

    def test_requires_lng(self, api_client):
        response = api_client.get(f'{self.URL}?lat={self.LAGOS_LAT}')
        assert response.status_code == 400

    def test_invalid_coordinates_rejected(self, api_client):
        response = api_client.get(f'{self.URL}?lat=999&lng=999')
        assert response.status_code == 400

    def test_non_numeric_rejected(self, api_client):
        response = api_client.get(f'{self.URL}?lat=abc&lng=xyz')
        assert response.status_code == 400

    def test_returns_active_listings_in_radius(self, api_client, owner_user):
        from tests.factories import ListingFactory
        close = ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        far = ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(5.0000, 10.0000, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&radius=10'
        )
        assert response.status_code == 200
        ids = [r['id'] for r in response.data['data']]
        assert str(close.id) in ids
        assert str(far.id) not in ids

    def test_draft_listings_not_returned(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user,
            status='draft',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}'
        )
        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_results_include_distance_km(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}'
        )
        assert response.status_code == 200
        assert len(response.data['data']) > 0
        assert 'distance_km' in response.data['data'][0]
        assert response.data['data'][0]['distance_km'] is not None

    def test_results_ordered_by_distance(self, api_client, owner_user):
        from tests.factories import ListingFactory
        near = ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        far = ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(3.4500, 6.5800, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}'
        )
        ids = [r['id'] for r in response.data['data']]
        assert ids.index(str(near.id)) < ids.index(str(far.id))

    def test_filter_by_resource_type(self, api_client, owner_user):
        from tests.factories import ListingFactory, WarehouseListingFactory
        ListingFactory(
            owner=owner_user,
            status='active',
            resource_type='equipment',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        WarehouseListingFactory(
            owner=owner_user,
            status='active',
            resource_type='warehouse',
            location=Point(3.3810, 6.5260, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&resource_type=equipment'
        )
        assert response.data['count'] == 1
        assert response.data['data'][0]['resource_type'] == 'equipment'

    def test_invalid_resource_type_returns_400(self, api_client):
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&resource_type=invalid'
        )
        assert response.status_code == 400

    def test_unavailable_listings_excluded_by_default(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user,
            status='active',
            is_available=False,
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}'
        )
        assert response.data['count'] == 0

    def test_available_false_param_includes_all(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user,
            status='active',
            is_available=False,
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&available=false'
        )
        assert response.data['count'] == 1

    def test_unauthenticated_user_can_search(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user,
            status='active',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}'
        )
        assert response.status_code == 200

    def test_radius_cap_at_500km(self, api_client):
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&radius=99999'
        )
        assert response.status_code == 200
        assert response.data['radius_km'] == 500

    def test_q_param_filters_by_title(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user, status='active', title='Mobile Crane Lagos',
            category='Mobile Crane',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        ListingFactory(
            owner=owner_user, status='active', title='Flatbed Truck',
            category='Flatbed Truck',
            location=Point(3.3810, 6.5260, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&q=crane'
        )
        assert response.status_code == 200
        assert response.data['count'] == 1
        assert response.data['q'] == 'crane'
        assert 'Crane' in response.data['data'][0]['title']

    def test_search_param_alias_works(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user, status='active', title='Mobile Crane Lagos',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&search=crane'
        )
        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_q_filters_by_category(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user, status='active', category='Mobile Crane',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        ListingFactory(
            owner=owner_user, status='active', category='Flatbed Truck',
            location=Point(3.3810, 6.5260, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&q=flatbed'
        )
        assert response.data['count'] == 1

    def test_q_filters_by_city(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user, status='active', location_city='Kano',
            location=Point(8.5167, 12.0022, srid=4326),
        )
        ListingFactory(
            owner=owner_user, status='active', location_city='Lagos',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat=10&lng=8&radius=500&q=kano'
        )
        assert response.data['count'] == 1

    def test_empty_q_returns_all(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(owner=owner_user, status='active', location=Point(3.3800, 6.5250, srid=4326))
        ListingFactory(owner=owner_user, status='active', location=Point(3.3810, 6.5260, srid=4326))
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&q='
        )
        assert response.data['count'] == 2
        assert response.data['q'] is None

    def test_q_is_case_insensitive(self, api_client, owner_user):
        from tests.factories import ListingFactory
        ListingFactory(
            owner=owner_user, status='active', title='TOWER CRANE HEAVY',
            location=Point(3.3800, 6.5250, srid=4326),
        )
        response = api_client.get(
            f'{self.URL}?lat={self.LAGOS_LAT}&lng={self.LAGOS_LNG}&q=tower+crane'
        )
        assert response.data['count'] == 1
