from django.urls import path

from core.views import (
    ChangePasswordView,
    CsrfTokenView,
    EmployeeDetailView,
    EmployeeListCreateView,
    HealthCheckView,
    LoginView,
    LogoutView,
    SessionView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("auth/csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/session/", SessionView.as_view(), name="auth-session"),
    path(
        "auth/change-password/",
        ChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list"),
    path(
        "employees/<int:pk>/",
        EmployeeDetailView.as_view(),
        name="employee-detail",
    ),
]
