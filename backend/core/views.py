from django.contrib.auth import login, logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

from typing import ClassVar

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CustomUser
from core.permissions import HasChangedInitialPassword, IsHRFoodOrSuperAdmin
from core.serializers import (
    ChangePasswordSerializer,
    EmployeeCreateSerializer,
    EmployeeSerializer,
    EmployeeUpdateSerializer,
    LoginSerializer,
    SessionUserSerializer,
)


class HealthCheckView(APIView):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name='HealthResponse',
            fields={'status': serializers.CharField()},
        )
    )
    def get(self, request):
        return Response({'status': 'ok'})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfTokenView(APIView):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name='CsrfTokenResponse',
            fields={'csrf_token': serializers.CharField()},
        )
    )
    def get(self, request):
        return Response({'csrf_token': get_token(request)})


@method_decorator(csrf_protect, name='dispatch')
class LoginView(generics.GenericAPIView):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(responses={200: SessionUserSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        login(request, user)
        return Response(SessionUserSerializer(user).data)


class SessionView(generics.GenericAPIView):
    permission_classes: ClassVar[list] = [IsAuthenticated]
    serializer_class = SessionUserSerializer

    def get(self, request):
        return Response(self.get_serializer(request.user).data)


class ChangePasswordView(generics.GenericAPIView):
    permission_classes: ClassVar[list] = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(responses={200: SessionUserSerializer})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=('password', 'must_change_password'))
        update_session_auth_hash(request, user)
        return Response(SessionUserSerializer(user).data)


class LogoutView(APIView):
    permission_classes: ClassVar[list] = [IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]
    queryset = CustomUser.objects.filter(profile__isnull=False).select_related('profile')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return EmployeeCreateSerializer
        return EmployeeSerializer


class EmployeeDetailView(generics.RetrieveUpdateAPIView):
    http_method_names: ClassVar[list] = ['get', 'patch', 'head', 'options']
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]
    queryset = CustomUser.objects.filter(profile__isnull=False).select_related('profile')

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return EmployeeUpdateSerializer
        return EmployeeSerializer
