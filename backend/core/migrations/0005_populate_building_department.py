from django.db import migrations


def populate_references(apps, schema_editor):
    Profile = apps.get_model('core', 'Profile')
    Building = apps.get_model('core', 'Building')
    Department = apps.get_model('core', 'Department')

    db = schema_editor.connection.alias

    profiles = Profile.objects.using(db).all().iterator()

    for profile in profiles:
        building_number = (profile.building_number or '').strip()
        department_number = (profile.department_number or '').strip()

        if len(building_number) > 3:
            raise ValueError(
                f'Invalid building number for profile {profile.pk}: '
                f'{building_number!r}'
            )

        if len(department_number) > 3:
            raise ValueError(
                f'Invalid department number for profile {profile.pk}: '
                f'{department_number!r}'
            )

        building = None
        department = None

        if building_number:
            building, _ = Building.objects.using(db).get_or_create(
                number=building_number,
                defaults={'is_active': True},
            )

        if department_number:
            department, _ = Department.objects.using(db).get_or_create(
                number=department_number,
                defaults={'is_active': True},
            )

        Profile.objects.using(db).filter(pk=profile.pk).update(
            building_id=building.pk if building else None,
            department_id=department.pk if department else None,
        )


def reverse_references(apps, schema_editor):
    Profile = apps.get_model('core', 'Profile')
    db = schema_editor.connection.alias

    Profile.objects.using(db).update(
        building_id=None,
        department_id=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_create_building_department'),
    ]

    operations = [
        migrations.RunPython(
            populate_references,
            reverse_references,
        ),
    ]
