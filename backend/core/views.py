from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.contrib.auth import login as auth_login, logout as auth_logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie

from typing import ClassVar

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


class HealthViewSet(viewsets.ViewSet):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]

    @extend_schema(
        responses=inline_serializer(
            name='HealthResponse',
            fields={'status': serializers.CharField()},
        )
    )
    def list(self, request):
        return Response({'status': 'ok'})


class AuthViewSet(viewsets.GenericViewSet):
    permission_classes: ClassVar[list] = [IsAuthenticated]
    serializer_class = SessionUserSerializer

    def get_serializer_class(self):
        serializer_classes = {
            'login': LoginSerializer,
            'session': SessionUserSerializer,
            'change_password': ChangePasswordSerializer,
        }
        return serializer_classes.get(self.action, self.serializer_class)

    @extend_schema(
        responses=inline_serializer(
            name='CsrfTokenResponse',
            fields={'csrf_token': serializers.CharField()},
        )
    )
    @action(
        detail=False,
        methods=['get'],
        authentication_classes=[],
        permission_classes=[AllowAny],
    )
    @method_decorator(ensure_csrf_cookie)
    def csrf(self, request):
        return Response({'csrf_token': get_token(request)})

    @extend_schema(responses={200: SessionUserSerializer})
    @action(
        detail=False,
        methods=['post'],
        authentication_classes=[],
        permission_classes=[AllowAny],
    )
    @method_decorator(csrf_protect)
    def login(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        auth_login(request, user)
        return Response(SessionUserSerializer(user).data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def session(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False})

        return Response(self.get_serializer(request.user).data)

    @extend_schema(responses={200: SessionUserSerializer})
    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=('password', 'must_change_password'))
        update_session_auth_hash(request, user)
        return Response(SessionUserSerializer(user).data)

    @extend_schema(request=None, responses={204: None})
    @action(detail=False, methods=['post'])
    def logout(self, request):
        auth_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmployeeViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    http_method_names: ClassVar[list] = ['get', 'post', 'patch', 'head', 'options']
    permission_classes: ClassVar[list] = [
        IsAuthenticated,
        HasChangedInitialPassword,
        IsHRFoodOrSuperAdmin,
    ]
    queryset = CustomUser.objects.filter(profile__isnull=False).select_related('profile')

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeCreateSerializer
        if self.action == 'partial_update':
            return EmployeeUpdateSerializer
        return EmployeeSerializer
