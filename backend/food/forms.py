from django import forms
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile

from food.models import Drink, Food, Side
from food.services import prepare_catalog_image


class CatalogImageAdminForm(forms.ModelForm):
    def clean_image(self):
        image = self.cleaned_data.get('image')

        if not image:
            return image

        # Only process newly uploaded files.
        if not isinstance(image, UploadedFile):
            return image

        try:
            return prepare_catalog_image(image)
        except ValidationError as exc:
            raise forms.ValidationError(exc.messages) from exc


class FoodAdminForm(CatalogImageAdminForm):
    class Meta:
        model = Food
        fields = ('name', 'image', 'price', 'container_price')


class SideAdminForm(CatalogImageAdminForm):
    class Meta:
        model = Side
        fields = ('name', 'image', 'price')


class DrinkAdminForm(CatalogImageAdminForm):
    class Meta:
        model = Drink
        fields = ('name', 'image', 'price')
