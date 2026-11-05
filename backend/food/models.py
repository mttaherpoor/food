from django.db import models


class TimestampedModel(models.Model):
    datetime_created = models.DateTimeField(auto_now_add=True)
    datetime_modified = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Food(TimestampedModel):
    name = models.CharField(max_length=255)
    price = models.PositiveBigIntegerField()
    container_price = models.PositiveBigIntegerField()
    total_price = models.GeneratedField(
        expression=models.F('price') + models.F('container_price'),
        output_field=models.PositiveBigIntegerField(),
        db_persist=True,
    )

    def __str__(self) -> str:
        return self.name


class Side(TimestampedModel):
    name = models.CharField(max_length=255)
    price = models.PositiveBigIntegerField()

    def __str__(self) -> str:
        return self.name


class Drink(TimestampedModel):
    name = models.CharField(max_length=255)
    price = models.PositiveBigIntegerField()

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
