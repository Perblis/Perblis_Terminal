import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_alter_user_managers'),
    ]

    operations = [
        migrations.CreateModel(
            name='OwnerProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('business_name', models.CharField(blank=True, default='', max_length=200)),
                ('business_description', models.TextField(blank=True, default='')),
                ('business_logo', models.ImageField(blank=True, null=True, upload_to='business_logos/')),
                ('bank_name', models.CharField(blank=True, default='', max_length=100)),
                ('bank_account_number', models.CharField(blank=True, default='', max_length=20)),
                ('bank_account_name', models.CharField(blank=True, default='', max_length=200)),
                ('notify_new_booking_request', models.BooleanField(default=True)),
                ('notify_booking_confirmed', models.BooleanField(default=True)),
                ('notify_new_message', models.BooleanField(default=True)),
                ('notify_booking_cancelled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='owner_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'owner_profiles',
            },
        ),
    ]
