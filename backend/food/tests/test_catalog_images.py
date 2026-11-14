from django.contrib import admin
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from io import BytesIO
from tempfile import TemporaryDirectory

from PIL import Image

from food.forms import DrinkAdminForm, FoodAdminForm, SideAdminForm
from food.models import Drink, Food, Side
from food.serializers import DrinkSerializer, FoodSerializer, SideSerializer


def make_image(filename='test.png', image_format='PNG'):
    buffer = BytesIO()
    Image.new('RGB', (64, 64), '#397D8D').save(
        buffer,
        format=image_format,
    )
    return SimpleUploadedFile(
        filename,
        buffer.getvalue(),
        content_type='image/png' if image_format == 'PNG' else 'image/jpeg',
    )


class CatalogImageTests(TestCase):
    def setUp(self):
        self.media_directory = TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)

        media_override = override_settings(
            MEDIA_ROOT=self.media_directory.name,
        )
        media_override.enable()
        self.addCleanup(media_override.disable)

    def test_api_serializers_convert_uploaded_images_to_webp(self):
        cases = (
            (
                FoodSerializer,
                Food,
                {'name': 'Test Food', 'price': 100_000, 'container_price': 10_000},
            ),
            (
                SideSerializer,
                Side,
                {'name': 'Test Side', 'price': 20_000},
            ),
            (
                DrinkSerializer,
                Drink,
                {'name': 'Test Drink', 'price': 15_000},
            ),
        )

        for serializer_class, model, fields in cases:
            with self.subTest(model=model.__name__):
                serializer = serializer_class(
                    data={
                        **fields,
                        'image': make_image(),
                    }
                )

                self.assertTrue(serializer.is_valid(), serializer.errors)
                instance = serializer.save()

                self.assertTrue(instance.image.name.endswith('.webp'))

                with instance.image.open('rb') as file, Image.open(file) as image:
                    self.assertEqual(image.format, 'WEBP')

    def test_invalid_image_is_rejected(self):
        image = SimpleUploadedFile(
            'fake.png',
            b'this is not a real image',
            content_type='image/png',
        )

        serializer = SideSerializer(
            data={
                'name': 'Invalid Image',
                'price': 20_000,
                'image': image,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('image', serializer.errors)
        self.assertFalse(Side.objects.filter(name='Invalid Image').exists())

    def test_updating_price_preserves_existing_image(self):
        serializer = FoodSerializer(
            data={
                'name': 'Original Food',
                'price': 100_000,
                'container_price': 10_000,
                'image': make_image(),
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        food = serializer.save()

        original_image = food.image.name

        updated = FoodSerializer(food, data={'price': 200_000}, partial=True)

        self.assertTrue(updated.is_valid(), updated.errors)
        updated.save()

        food.refresh_from_db()

        self.assertEqual(food.image.name, original_image)
        self.assertTrue(food.image.storage.exists(original_image))

    def test_admin_forms_use_shared_image_processing(self):
        cases = (
            (
                FoodAdminForm,
                Food,
                {'name': 'Admin Food', 'price': 100_000, 'container_price': 10_000},
            ),
            (
                SideAdminForm,
                Side,
                {'name': 'Admin Side', 'price': 20_000},
            ),
            (
                DrinkAdminForm,
                Drink,
                {'name': 'Admin Drink', 'price': 15_000},
            ),
        )

        for form_class, model, fields in cases:
            with self.subTest(model=model.__name__):
                form = form_class(data=fields, files={'image': make_image()})

                self.assertTrue(form.is_valid(), form.errors)
                instance = form.save()

                self.assertTrue(instance.image.name.endswith('.webp'))

                with instance.image.open('rb') as file, Image.open(file) as image:
                    self.assertEqual(image.format, 'WEBP')

                self.assertIs(admin.site._registry[model].form, form_class)

    def test_catalog_http_multipart_upload(self):
        from rest_framework.test import APIClient

        from django.contrib.auth import get_user_model
        from django.urls import reverse

        user_model = get_user_model()
        user = user_model.objects.create_superuser(
            username='catalog-image-admin',
            password='TestPassword_123!',
        )

        if hasattr(user, 'must_change_password'):
            user.must_change_password = False
            user.save(update_fields=['must_change_password'])

        client = APIClient()
        client.force_authenticate(user=user)

        cases = (
            (
                'food-list',
                Food,
                {
                    'name': 'HTTP Food',
                    'price': 100_000,
                    'container_price': 10_000,
                },
            ),
            (
                'side-list',
                Side,
                {
                    'name': 'HTTP Side',
                    'price': 20_000,
                },
            ),
            (
                'drink-list',
                Drink,
                {
                    'name': 'HTTP Drink',
                    'price': 15_000,
                },
            ),
        )

        for route, model, fields in cases:
            with self.subTest(route=route):
                response = client.post(
                    reverse(route),
                    {
                        **fields,
                        'image': make_image(),
                    },
                    format='multipart',
                )

                self.assertEqual(response.status_code, 201, response.content)

                instance = model.objects.get(pk=response.data['id'])

                self.assertTrue(instance.image.name.endswith('.webp'))

                self.assertTrue(instance.image.storage.exists(instance.image.name))

                self.assertIn('image_data', response.data)
                self.assertIn(instance.image.name, response.data['image_data']['url'])

                with instance.image.open('rb') as file, Image.open(file) as image:
                    self.assertEqual(image.format, 'WEBP')
