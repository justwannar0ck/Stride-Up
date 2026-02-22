from rest_framework import serializers
from .models import User, Follow, FollowRequest, PrivacyZone, UserPrivacySettings
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from djoser.serializers import UserSerializer as BaseUserSerializer
from django.contrib.gis.geos import Point

class UserCreateSerializer(BaseUserCreateSerializer):
    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = ('id', 'email', 'username', 'password', 'first_name', 'last_name')

class UserSerializer(BaseUserSerializer):
    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = ('id', 'email', 'username', 'first_name', 'last_name', 'profile_picture', 'bio')


class UserMinimalSerializer(serializers.ModelSerializer):
    """Minimal user info for lists."""
    
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'profile_picture']


class UserProfileSerializer(serializers.ModelSerializer):
    """User's profile with follow stats."""
    
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    is_followed_by = serializers.SerializerMethodField()
    follow_status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'bio', 'profile_picture',
            'is_private', 'followers_count', 'following_count',
            'is_following', 'is_followed_by', 'follow_status',
            'created_at'
        ]
    
    def get_is_following(self, obj):
        """Checks if the requesting user is following this user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj:
                return None  # Same user
            return request.user.is_following(obj)
        return False
    
    def get_is_followed_by(self, obj):
        """Checks if this user is following the requesting user."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj:
                return None
            return obj.is_following(request.user)
        return False
    
    def get_follow_status(self, obj):
        """
        Returns the follow status between requesting user and this user.
        Values: 'self', 'following', 'requested', 'not_following'
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 'not_following'
        
        if request.user == obj:
            return 'self'
        
        if request.user.is_following(obj):
            return 'following'
        
        if request.user.has_pending_follow_request_to(obj):
            return 'requested'
        
        return 'not_following'

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile."""
    
    class Meta:
        model = User
        fields = [
            'first_name', 
            'last_name', 
            'bio', 
            'profile_picture', 
            'is_private',
            'date_of_birth',
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'bio': {'required': False},
            'profile_picture': {'required': False},
            'is_private': {'required': False},
            'date_of_birth': {'required': False},
        }

class FollowSerializer(serializers.ModelSerializer):
    """Serializer for Follow relationships."""
    
    follower = UserMinimalSerializer(read_only=True)
    following = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'created_at']


class FollowerListSerializer(serializers.ModelSerializer):
    """Serializer for listing followers."""
    
    user = serializers.SerializerMethodField()
    is_following_back = serializers.SerializerMethodField()
    
    class Meta:
        model = Follow
        fields = ['id', 'user', 'is_following_back', 'created_at']
    
    def get_user(self, obj):
        return UserMinimalSerializer(obj.follower).data
    
    def get_is_following_back(self, obj):
        """Checks if the profile owner follows this follower back."""
        request = self.context.get('request')
        profile_user = self.context.get('profile_user')
        if profile_user:
            return profile_user.is_following(obj.follower)
        return False


class FollowingListSerializer(serializers.ModelSerializer):
    """Serializer for listing users being followed."""
    
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = Follow
        fields = ['id', 'user', 'created_at']
    
    def get_user(self, obj):
        return UserMinimalSerializer(obj.following).data


class FollowRequestSerializer(serializers.ModelSerializer):
    """Serializer for follow requests."""
    
    from_user = UserMinimalSerializer(read_only=True)
    to_user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = FollowRequest
        fields = ['id', 'from_user', 'to_user', 'status', 'created_at']


class PendingFollowRequestSerializer(serializers.ModelSerializer):
    """Serializer for listing pending follow requests."""
    
    user = serializers.SerializerMethodField()
    
    class Meta:
        model = FollowRequest
        fields = ['id', 'user', 'created_at']
    
    def get_user(self, obj):
        return UserMinimalSerializer(obj.from_user).data
    
class PrivacyZoneSerializer(serializers.ModelSerializer):
    latitude = serializers.FloatField(write_only=True)
    longitude = serializers.FloatField(write_only=True)
    center_latitude = serializers.SerializerMethodField(read_only=True)
    center_longitude = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PrivacyZone
        fields = [
            'id', 'name', 'latitude', 'longitude',
            'center_latitude', 'center_longitude',
            'radius', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_center_latitude(self, obj):
        return obj.center.y if obj.center else None
    
    def get_center_longitude(self, obj):
        return obj.center.x if obj.center else None
    
    def create(self, validated_data):
        latitude = validated_data.pop('latitude')
        longitude = validated_data.pop('longitude')
        validated_data['center'] = Point(longitude, latitude, srid=4326)
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        if 'latitude' in validated_data and 'longitude' in validated_data:
            latitude = validated_data.pop('latitude')
            longitude = validated_data.pop('longitude')
            validated_data['center'] = Point(longitude, latitude, srid=4326)
        return super().update(instance, validated_data)
    
class UserPrivacySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPrivacySettings
        fields = [
            'default_hide_start_end',
            'default_privacy_radius',
            'default_visibility'
        ]