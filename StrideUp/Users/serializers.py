from rest_framework import serializers
from django.contrib.auth import get_user_model
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from djoser.serializers import UserSerializer as BaseUserSerializer

User = get_user_model()


class UserCreateSerializer(BaseUserCreateSerializer):
    """
    Serializer for user registration.
    Extends Djoser's UserCreateSerializer to include additional fields.
    """
    
    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = (
            'id',
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
        )
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate_email(self, value):
        """Ensure email is unique."""
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_username(self, value):
        """Ensure username is lowercase and valid."""
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        return value.lower()

    def create(self, validated_data):
        """Create user with validated data."""
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user


class UserSerializer(BaseUserSerializer):
    """
    Serializer for user profile data.
    Used for retrieving and updating user information.
    """
    
    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'bio',
            'date_of_birth',
            'is_private',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'username', 'email', 'created_at', 'updated_at')