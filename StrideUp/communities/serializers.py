from rest_framework import serializers
from .models import (
    Community, CommunityMembership, CommunityInvite,
    CommunityChallenge, ChallengeParticipation
)
from Users.serializers import UserMinimalSerializer


class CommunityListSerializer(serializers.ModelSerializer):
    """For listing communities (search, browse, my communities)."""
    members_count = serializers.IntegerField(read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_member = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    
    class Meta:
        model = Community
        fields = [
            'id', 'name', 'slug', 'description', 'cover_image', 'icon_image',
            'visibility', 'activity_types', 'members_count',
            'created_by_username', 'is_member', 'my_role', 'created_at',
        ]
    
    def get_is_member(self, obj):
        if hasattr(obj, 'active_members_count'):
            return obj.active_members_count
        return obj.members_count
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            return obj.memberships.filter(
                user=request.user, status=CommunityMembership.Status.ACTIVE
            ).exists()
        return False
    
    def get_my_role(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            membership = obj.memberships.filter(
                user=request.user, status=CommunityMembership.Status.ACTIVE
            ).first()
            return membership.role if membership else None
        return None


class CommunityCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = [
            'name', 'description', 'cover_image', 'icon_image',
            'visibility', 'max_members', 'activity_types',
        ]


class CommunityDetailSerializer(serializers.ModelSerializer):
    """Full detail view of a community."""
    members_count = serializers.IntegerField(read_only=True)
    created_by = UserMinimalSerializer(read_only=True)
    is_member = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()
    # Placeholder: upcoming challenges count
    active_challenges_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Community
        fields = [
            'id', 'name', 'slug', 'description', 'cover_image', 'icon_image',
            'visibility', 'max_members', 'activity_types', 'members_count',
            'created_by', 'is_member', 'my_role', 'pending_count',
            'active_challenges_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['slug', 'id']
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.memberships.filter(
                user=request.user, status=CommunityMembership.Status.ACTIVE
            ).exists()
        return False
    
    def get_my_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(
                user=request.user, status=CommunityMembership.Status.ACTIVE
            ).first()
            return membership.role if membership else None
        return None
    
    def get_pending_count(self, obj):
        """Number of pending join requests (only relevant for admins)."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(
                user=request.user, status=CommunityMembership.Status.ACTIVE
            ).first()
            if membership and membership.can_manage_members:
                return obj.memberships.filter(
                    status=CommunityMembership.Status.PENDING
                ).count()
        return 0
    
    def get_active_challenges_count(self, obj):
        return obj.challenges.filter(
            status=CommunityChallenge.Status.ACTIVE
        ).count()


class MembershipSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = CommunityMembership
        fields = ['id', 'user', 'role', 'status', 'joined_at']


class CommunityInviteSerializer(serializers.ModelSerializer):
    invited_user = UserMinimalSerializer(read_only=True)
    invited_by = UserMinimalSerializer(read_only=True)
    community_name = serializers.CharField(source='community.name', read_only=True)
    
    class Meta:
        model = CommunityInvite
        fields = [
            'id', 'community', 'community_name', 'invited_user',
            'invited_by', 'status', 'created_at', 'expires_at',
        ]