import django_filters
from .models import Thread


class ThreadFilter(django_filters.FilterSet):
    listing_id = django_filters.UUIDFilter(field_name='listing__id')
    thread_type = django_filters.CharFilter(method='filter_thread_type')
    unread = django_filters.BooleanFilter(method='filter_unread')

    class Meta:
        model = Thread
        fields = ['listing_id', 'thread_type', 'unread']

    def filter_thread_type(self, queryset, name, value):
        if value == 'booking':
            return queryset.filter(booking__isnull=False)
        elif value == 'inquiry':
            return queryset.filter(booking__isnull=True)
        return queryset

    def filter_unread(self, queryset, name, value):
        user = self.request.user
        if value is True:
            from .models import Message
            thread_ids_with_unread = Message.objects.filter(
                is_read=False,
            ).exclude(
                sender=user,
            ).values_list('thread_id', flat=True).distinct()
            return queryset.filter(id__in=thread_ids_with_unread)
        return queryset
