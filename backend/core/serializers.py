from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed

from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError

from core.models import CustomUser
from core.services import create_employee, update_employee


def convert_validation_error(exc: DjangoValidationError) -> serializers.ValidationError:
    errors = exc.message_dict if hasattr(exc, 'message_dict') else exc.messages
    if isinstance(errors, dict) and 'username' in errors:
        errors['personnel_number'] = errors.pop('username')
    return serializers.ValidationError(errors)


class SessionUserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id',
            'username',
            'first_name',
            'last_name',
            'is_active',
            'is_superuser',
            'must_change_password',
            'roles',
        )
        read_only_fields = fields

    def get_roles(self, user: CustomUser) -> list[str]:
        return list(user.groups.order_by('name').values_list('name', flat=True))


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            username=attrs['username'],
            password=attrs['password'],
        )
        if user is None:
            raise AuthenticationFailed('Invalid username or password.')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password = serializers.CharField(trim_whitespace=False, write_only=True)
    new_password_confirm = serializers.CharField(
        trim_whitespace=False,
        write_only=True,
    )

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['old_password']):
            raise serializers.ValidationError({'old_password': 'The current password is incorrect.'})
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'The two password values do not match.'})
        if attrs['new_password'] == user.username:
            raise serializers.ValidationError({'new_password': 'The new password cannot be the personnel number.'})
        try:
            password_validation.validate_password(attrs['new_password'], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)}) from exc
        return attrs


class EmployeeSerializer(serializers.ModelSerializer):
    personnel_number = serializers.CharField(source='profile.personnel_number')
    building_number = serializers.CharField(source='profile.building_number')
    department_number = serializers.CharField(source='profile.department_number')

    class Meta:
        model = CustomUser
        fields = (
            'id',
            'personnel_number',
            'first_name',
            'last_name',
            'building_number',
            'department_number',
            'is_active',
            'must_change_password',
        )
        read_only_fields = fields


class EmployeeCreateSerializer(serializers.Serializer):
    personnel_number = serializers.CharField(max_length=32)
    building_number = serializers.CharField(max_length=32)
    department_number = serializers.CharField(max_length=32)
    is_active = serializers.BooleanField(default=True)

    def create(self, validated_data):
        try:
            return create_employee(**validated_data)
        except DjangoValidationError as exc:
            raise convert_validation_error(exc) from exc

    def to_representation(self, instance):
        return EmployeeSerializer(instance, context=self.context).data


class EmployeeUpdateSerializer(serializers.Serializer):
    personnel_number = serializers.CharField(max_length=32, required=False)
    building_number = serializers.CharField(max_length=32, required=False)
    department_number = serializers.CharField(max_length=32, required=False)
    is_active = serializers.BooleanField(required=False)

    def update(self, instance, validated_data):
        try:
            return update_employee(instance, **validated_data)
        except DjangoValidationError as exc:
            raise convert_validation_error(exc) from exc

    def to_representation(self, instance):
        return EmployeeSerializer(instance, context=self.context).data
