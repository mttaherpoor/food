from django.conf import settings
from django.db import models
from django.db.models import Q

from typing import ClassVar

from .mixins import CatalogImageMixin


class TimestampedModel(models.Model):
    datetime_created = models.DateTimeField(auto_now_add=True)
    datetime_modified = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Food(CatalogImageMixin, TimestampedModel):
    DEFAULT_IMAGE = "images/defaults/default-food.webp"

    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to='foods/', blank=True)
    price = models.PositiveBigIntegerField(
        verbose_name='price (Toman)',
        help_text='Whole amount in Toman.',
    )
    container_price = models.PositiveBigIntegerField(
        verbose_name='container price (Toman)',
        help_text='Whole amount in Toman.',
    )
    total_price = models.GeneratedField(
        verbose_name='total price (Toman)',
        expression=models.F('price') + models.F('container_price'),
        output_field=models.PositiveBigIntegerField(),
        db_persist=True,
    )

    def __str__(self) -> str:
        return self.name


class Side(CatalogImageMixin, TimestampedModel):
    DEFAULT_IMAGE = "images/defaults/default-side.webp"

    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to='sides/', blank=True)
    price = models.PositiveBigIntegerField(
        verbose_name='price (Toman)',
        help_text='Whole amount in Toman.',
    )

    def __str__(self) -> str:
        return self.name


class Drink(CatalogImageMixin, TimestampedModel):
    DEFAULT_IMAGE = "images/defaults/default-drink.webp"

    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to='drinks/', blank=True)
    price = models.PositiveBigIntegerField(
        verbose_name='price (Toman)',
        help_text='Whole amount in Toman.',
    )

    def __str__(self) -> str:
        return self.name


class MenuStatus(models.TextChoices):
    AVAILABLE = 'avl', 'Available'
    RESERVED = 'res', 'Reserved'
    CANCELLED = 'can', 'Cancelled'


class Menu(TimestampedModel):
    date = models.DateField()
    food = models.ForeignKey(Food, on_delete=models.PROTECT, related_name='menus')
    food_price = models.PositiveBigIntegerField(
        verbose_name='food price snapshot (Toman)',
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=3,
        choices=MenuStatus.choices,
        default=MenuStatus.AVAILABLE,
    )

    class Meta:
        constraints: ClassVar[list] = [models.UniqueConstraint(fields=('date',), name='unique_menu_per_date')]

    def __str__(self) -> str:
        return f'{self.date}: {self.food}'

    def save(self, *args, **kwargs) -> None:
        if self.food_price is None:
            self.food_price = self.food.total_price
        super().save(*args, **kwargs)


class Reservation(TimestampedModel):
    class Status(models.TextChoices):
        RESERVED = 'res', 'Reserved'
        CANCELLED = 'can', 'Cancelled'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reservations')
    menu = models.ForeignKey(Menu, on_delete=models.PROTECT, related_name='reservations')
    status = models.CharField(max_length=3, choices=Status.choices, default=Status.RESERVED)

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(fields=('user', 'menu'), name='unique_reservation_per_user_menu'),
        ]
        ordering = ('menu__date', 'user_id')

    @property
    def total_price(self) -> int:
        if self.status == self.Status.CANCELLED:
            return 0
        current_item = self.items.filter(is_current=True, is_cancelled=False).first()
        return current_item.total_price if current_item else 0

    @property
    def current_item(self):
        return self.items.filter(is_current=True).first()

    def __str__(self) -> str:
        return f'{self.user} - {self.menu.date}'


class ReservationItem(TimestampedModel):
    reservation = models.ForeignKey(Reservation, on_delete=models.PROTECT, related_name='items')
    building = models.ForeignKey(
        'core.Building',
        on_delete=models.PROTECT,
        related_name='reservation_items',
        null=True,
        blank=True,
    )
    building_number_snapshot = models.CharField(
        max_length=3,
        null=True,
        blank=True,
    )
    side = models.ForeignKey(Side, on_delete=models.PROTECT, related_name='reservation_items', null=True, blank=True)
    drink = models.ForeignKey(Drink, on_delete=models.PROTECT, related_name='reservation_items', null=True, blank=True)
    food_price = models.PositiveBigIntegerField(verbose_name='food price snapshot (Toman)')
    side_price = models.PositiveBigIntegerField(verbose_name='side price snapshot (Toman)', default=0)
    drink_price = models.PositiveBigIntegerField(verbose_name='drink price snapshot (Toman)', default=0)
    food_quantity = models.PositiveSmallIntegerField(default=1)
    side_quantity = models.PositiveSmallIntegerField(default=0)
    drink_quantity = models.PositiveSmallIntegerField(default=0)
    is_current = models.BooleanField(default=True)
    is_cancelled = models.BooleanField(default=False)

    class Meta:
        ordering = ('reservation_id', '-datetime_created', '-pk')
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=('reservation',),
                condition=Q(is_current=True),
                name='unique_current_reservation_item',
            ),
            models.CheckConstraint(condition=Q(food_quantity__gte=1), name='reservation_food_quantity_positive'),
            models.CheckConstraint(
                condition=Q(side__isnull=False, side_quantity__gte=1) | Q(side__isnull=True, side_quantity=0),
                name='reservation_side_selection_consistent',
            ),
            models.CheckConstraint(
                condition=Q(drink__isnull=False, drink_quantity__gte=1) | Q(drink__isnull=True, drink_quantity=0),
                name='reservation_drink_selection_consistent',
            ),
        ]

    @property
    def total_price(self) -> int:
        if self.is_cancelled:
            return 0
        return (
            self.food_price * self.food_quantity
            + sum(item.total_price for item in self.side_items.all())
            + sum(item.total_price for item in self.drink_items.all())
        )

    def __str__(self) -> str:
        return f'{self.reservation} (revision {self.pk})'


class ReservationSideItem(TimestampedModel):
    reservation_item = models.ForeignKey(ReservationItem,on_delete=models.PROTECT,related_name='side_items')
    side = models.ForeignKey(Side, on_delete=models.PROTECT, related_name='reservation_side_items')

    quantity = models.PositiveIntegerField()
    unit_price = models.PositiveBigIntegerField()

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=('reservation_item', 'side'),
                name='unique_side_per_revision',
            ),
            models.CheckConstraint(
                condition=Q(quantity__gte=1),
                name='reservation_side_quantity_positive',
            ),
        ]

    @property
    def total_price(self) -> int:
        return self.quantity * self.unit_price


class ReservationDrinkItem(TimestampedModel):
    reservation_item = models.ForeignKey(ReservationItem,on_delete=models.PROTECT,related_name='drink_items')
    drink = models.ForeignKey(Drink, on_delete=models.PROTECT, related_name='reservation_drink_items')

    quantity = models.PositiveIntegerField()
    unit_price = models.PositiveBigIntegerField()

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=('reservation_item', 'drink'),
                name='unique_drink_per_revision',
            ),
            models.CheckConstraint(
                condition=Q(quantity__gte=1),
                name='reservation_drink_quantity_positive',
            ),
        ]

    @property
    def total_price(self) -> int:
        return self.quantity * self.unit_price
