import pytest
from core.models import BaseModel
from django.db import models


@pytest.mark.unit
class TestBaseModel:
    def test_base_model_is_abstract(self):
        assert BaseModel._meta.abstract is True

    def test_base_model_has_uuid_id(self):
        field = BaseModel._meta.get_field('id')
        assert field.primary_key is True
        assert field.editable is False

    def test_base_model_has_created_at(self):
        field = BaseModel._meta.get_field('created_at')
        assert field.auto_now_add is True

    def test_base_model_has_updated_at(self):
        field = BaseModel._meta.get_field('updated_at')
        assert field.auto_now is True
