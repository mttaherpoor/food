from django.urls import reverse


def test_health_check_is_public(client):
    response = client.get(reverse("health-check"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
