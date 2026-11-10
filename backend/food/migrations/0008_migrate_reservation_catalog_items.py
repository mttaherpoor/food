from django.db import migrations


def migrate_reservation_items(apps, schema_editor):
    ReservationItem = apps.get_model('food', 'ReservationItem')
    ReservationSideItem = apps.get_model('food', 'ReservationSideItem')
    ReservationDrinkItem = apps.get_model('food', 'ReservationDrinkItem')

    db_alias = schema_editor.connection.alias

    items = ReservationItem.objects.using(db_alias).all()

    for item in items.iterator(chunk_size=500):
        if item.side_id is not None:
            if item.side_quantity < 1:
                raise ValueError(
                    f'Invalid side quantity in ReservationItem {item.pk}'
                )

            ReservationSideItem.objects.using(db_alias).get_or_create(
                reservation_item_id=item.pk,
                side_id=item.side_id,
                defaults={
                    'quantity': item.side_quantity,
                    'unit_price': item.side_price,
                },
            )

        if item.drink_id is not None:
            if item.drink_quantity < 1:
                raise ValueError(
                    f'Invalid drink quantity in ReservationItem {item.pk}'
                )

            ReservationDrinkItem.objects.using(db_alias).get_or_create(
                reservation_item_id=item.pk,
                drink_id=item.drink_id,
                defaults={
                    'quantity': item.drink_quantity,
                    'unit_price': item.drink_price,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ('food', '0007_add_reservation_multi_select_items'),
    ]

    operations = [
        migrations.RunPython(
            migrate_reservation_items,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
