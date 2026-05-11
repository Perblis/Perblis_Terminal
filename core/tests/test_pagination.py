import pytest
from core.pagination import StandardPagination


@pytest.mark.unit
class TestStandardPagination:
    def test_default_page_size(self):
        p = StandardPagination()
        assert p.page_size == 20

    def test_max_page_size(self):
        p = StandardPagination()
        assert p.max_page_size == 100

    def test_page_size_query_param(self):
        p = StandardPagination()
        assert p.page_size_query_param == 'page_size'
