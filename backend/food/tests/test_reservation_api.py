from django.urls import reverse
from django.utils import timezone

from datetime import date, datetime

import pytest

from core.models import CustomUser
from core.services import create_employee
from food.models import Drink, Food, Menu, Reservation, ReservationItem, Side


def create_employee_user(personnel_number: str = 'res-001') -> CustomUser:
    user = create_employee(
        personnel_number=personnel_number,
        building_number='07',
        department_number='003',
    )
    user.must_change_password = False
    user.save(update_fields=('must_change_password',))
    return user


@pytest.mark.django_db
def test_employee_can_create_week_reservations_with_optional_sides_and_drinks(client):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    side = Side.objects.create(name='Salad', price=200_000)
    drink = Drink.objects.create(name='Doogh', price=150_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)

    response = client.post(
        reverse('reservation-list'),
        {
            'reservations': [
                {'menu': menu.pk, 'side': side.pk, 'drink': drink.pk},
            ],
        },
        content_type='application/json',
    )

    assert response.status_code == 201
    reservation = Reservation.objects.get(user=user, menu=menu)
    item = reservation.current_item
    assert item.food_quantity == 1
    assert item.side_quantity == 1
    assert item.drink_quantity == 1
    assert item.food_price == 1_100_000
    assert reservation.total_price == 1_450_000


@pytest.mark.django_db
def test_reservation_edit_and_cancel_keep_history_and_price_snapshots(client):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    side = Side.objects.create(name='Salad', price=200_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    create_response = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk, 'side': side.pk}]},
        content_type='application/json',
    )
    reservation_id = create_response.json()[0]['id']
    side.price = 300_000
    side.save(update_fields=('price', 'datetime_modified'))
    food.price = 2_000_000
    food.save(update_fields=('price', 'datetime_modified'))

    edit_response = client.patch(
        reverse('reservation-detail', kwargs={'pk': reservation_id}),
        {'side': None},
        content_type='application/json',
    )
    assert edit_response.status_code == 200
    reservation = Reservation.objects.get(pk=reservation_id)
    old_item, current_item = list(reservation.items.order_by('id'))
    assert old_item.is_current is False
    assert old_item.side_price == 200_000
    assert current_item.side is None
    assert current_item.side_price == 0
    assert current_item.food_price == 1_100_000

    cancel_response = client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
    assert cancel_response.status_code == 200
    assert cancel_response.json()['total_price'] == 0
    assert cancel_response.json()['status'] == Reservation.Status.CANCELLED
    assert reservation.items.count() == 3
    assert reservation.items.filter(is_current=True, is_cancelled=True).count() == 1


@pytest.mark.django_db
def test_employee_cannot_reserve_past_menu_or_reserve_twice(client):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    past_menu = Menu.objects.create(date=date(2000, 1, 2), food=food)
    past_response = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': past_menu.pk}]},
        content_type='application/json',
    )
    assert past_response.status_code == 400

    future_menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    payload = {'reservations': [{'menu': future_menu.pk}]}
    assert client.post(reverse('reservation-list'), payload, content_type='application/json').status_code == 201
    duplicate_response = client.post(reverse('reservation-list'), payload, content_type='application/json')
    assert duplicate_response.status_code == 400
    assert ReservationItem.objects.count() == 1


@pytest.mark.django_db
def test_reservation_is_rejected_at_previous_day_cutoff(client, monkeypatch):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    now = timezone.make_aware(datetime(2099, 1, 1, 10, 0))
    monkeypatch.setattr('food.services._tehran_now', lambda: now)

    response = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk}]},
        content_type='application/json',
    )

    assert response.status_code == 400
    assert Reservation.objects.count() == 0


@pytest.mark.django_db
def test_employee_can_load_weekly_menu_and_only_sees_own_reservations(client):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    Menu.objects.create(date=date(2099, 1, 2), food=food)

    response = client.get(reverse('reservation-weekly'), {'start': '2099-01-01'})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]['food_price'] == 1_100_000
    assert response.json()[0]['reservation'] is None


@pytest.mark.django_db
def test_employee_can_add_optional_drink_during_edit_with_default_quantity_one(client):
    user = create_employee_user()
    client.force_login(user)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    drink = Drink.objects.create(name='Doogh', price=150_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    created = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk}]},
        content_type='application/json',
    )
    reservation_id = created.json()[0]['id']

    updated = client.patch(
        reverse('reservation-detail', kwargs={'pk': reservation_id}),
        {'drink': drink.pk},
        content_type='application/json',
    )

    assert updated.status_code == 200
    item = updated.json()['current_item']
    assert item['drink'] == drink.pk
    assert item['drink_quantity'] == 1
    assert item['total_price'] == 1_250_000


@pytest.mark.django_db
def test_employee_cannot_read_another_employees_reservation(client):
    owner = create_employee_user()
    client.force_login(owner)
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    created = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk}]},
        content_type='application/json',
    )
    reservation_id = created.json()[0]['id']
    client.force_login(create_employee_user('res-002'))

    response = client.get(reverse('reservation-detail', kwargs={'pk': reservation_id}))

    assert response.status_code == 404


@pytest.mark.django_db
def test_reservation_batch_rolls_back_when_one_day_is_invalid(client):
    client.force_login(create_employee_user())
    food = Food.objects.create(name='Ghormeh sabzi', price=1_000_000, container_price=100_000)
    valid_menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    past_menu = Menu.objects.create(date=date(2000, 1, 2), food=food)

    response = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': valid_menu.pk}, {'menu': past_menu.pk}]},
        content_type='application/json',
    )

    assert response.status_code == 400
    assert Reservation.objects.count() == 0


@pytest.mark.django_db
def test_employee_must_change_initial_password_before_reserving(client):
    employee = create_employee(personnel_number='res-003', building_number='07', department_number='003')
    client.force_login(employee)

    response = client.get(reverse('reservation-list'))

    assert response.status_code == 403


@pytest.mark.django_db
def test_cancelled_reservation_can_be_reactivated_before_cutoff_without_losing_history(client):
    user = create_employee_user('res-restore')
    client.force_login(user)
    food = Food.objects.create(name='Restore test', price=100_000, container_price=10_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    created = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk, 'food_quantity': 1}]},
        content_type='application/json',
    )
    assert created.status_code == 201
    reservation_id = created.json()[0]['id']
    cancelled = client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
    assert cancelled.status_code == 200
    restored = client.patch(
        reverse('reservation-detail', kwargs={'pk': reservation_id}),
        {'food_quantity': 2}, content_type='application/json',
    )
    assert restored.status_code == 200
    reservation = Reservation.objects.get(pk=reservation_id)
    assert reservation.status == Reservation.Status.RESERVED
    assert reservation.items.count() == 3
    assert reservation.items.filter(is_current=True, is_cancelled=False).count() == 1
    assert reservation.current_item.food_quantity == 2
    assert reservation.total_price == 220_000
    assert Reservation.objects.filter(user=user, menu=menu).count() == 1
    second_cancel = client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id}))
    assert second_cancel.status_code == 200
    assert reservation.items.count() == 4


@pytest.mark.django_db
def test_cancelled_reservation_cannot_be_restored_after_cutoff(client, monkeypatch):
    from zoneinfo import ZoneInfo
    user = create_employee_user('res-expired')
    client.force_login(user)
    food = Food.objects.create(name='Expired restore', price=100_000, container_price=10_000)
    menu = Menu.objects.create(date=date(2099, 1, 2), food=food)
    created = client.post(
        reverse('reservation-list'),
        {'reservations': [{'menu': menu.pk}]}, content_type='application/json',
    )
    reservation_id = created.json()[0]['id']
    assert client.post(reverse('reservation-cancel', kwargs={'pk': reservation_id})).status_code == 200
    tehran_time = datetime(2099, 1, 1, 10, 0, tzinfo=ZoneInfo('Asia/Tehran'))
    monkeypatch.setattr('food.services._tehran_now', lambda: tehran_time)
    response = client.patch(
        reverse('reservation-detail', kwargs={'pk': reservation_id}),
        {'food_quantity': 1}, content_type='application/json',
    )
    assert response.status_code == 400
    reservation = Reservation.objects.get(pk=reservation_id)
    assert reservation.status == Reservation.Status.CANCELLED
    assert reservation.items.count() == 2
