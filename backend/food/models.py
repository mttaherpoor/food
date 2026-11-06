from django.db import models


class TimestampedModel(models.Model):
    datetime_created = models.DateTimeField(auto_now_add=True)
    datetime_modified = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Food(TimestampedModel):
    name = models.CharField(max_length=255)
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


class Side(TimestampedModel):
    name = models.CharField(max_length=255)
    price = models.PositiveBigIntegerField(
        verbose_name='price (Toman)',
        help_text='Whole amount in Toman.',
    )

    def __str__(self) -> str:
        return self.name


class Drink(TimestampedModel):
    name = models.CharField(max_length=255)
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
    status = models.CharField(
        max_length=3,
        choices=MenuStatus.choices,
        default=MenuStatus.AVAILABLE,
    )

    def __str__(self) -> str:
        return f'{self.date}: {self.food}'
