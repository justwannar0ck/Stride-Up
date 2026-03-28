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
    """User's profile with follow stats and badges."""
    
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    is_followed_by = serializers.SerializerMethodField()
    follow_status = serializers.SerializerMethodField()
    #badges = serializers.SerializerMethodField()
    #badges_count = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'bio', 'profile_picture',
            'is_private', 'followers_count', 'following_count',
            'is_following', 'is_followed_by', 'follow_status',
            #'badges', 'badges_count',
            'created_at'
        ]
    
    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj:
                return None
            return request.user.is_following(obj)
        return False
    
    def get_is_followed_by(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj:
                return None
            return obj.is_following(request.user)
        return False
    
    def get_follow_status(self, obj):
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
    
    #def get_badges(self, obj):
    #    """Returns the user's most recent 6 earned badges."""
    #   from achievements.models import UserBadge
    #   from achievements.serializers import UserBadgeSerializer
        
    #   recent = UserBadge.objects.filter(
    #       user=obj
    #   ).select_related('badge').order_by('-earned_at')[:6]
    #   return UserBadgeSerializer(recent, many=True).data
    
    #def get_badges_count(self, obj):
    #   """Returns total number of badges earned."""
    #   from achievements.models import UserBadge
    #   return UserBadge.objects.filter(user=obj).count()

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
            'is_ai_coach_enabled', 'weight_kg', 'height_cm', 'gender', 
            'resting_heart_rate', 'max_heart_rate', 'experience_level', 
            'primary_goal', 'medical_conditions_or_injuries',
        ]
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'bio': {'required': False},
            'profile_picture': {'required': False},
            'is_private': {'required': False},
            'date_of_birth': {'required': False},
            'is_ai_coach_enabled': {'required': False},
            'weight_kg': {'required': False},
            'height_cm': {'required': False},
            'gender': {'required': False},
            'resting_heart_rate': {'required': False},
            'max_heart_rate': {'required': False},
            'experience_level': {'required': False},
            'primary_goal': {'required': False},
            'medical_conditions_or_injuries': {'required': False},
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