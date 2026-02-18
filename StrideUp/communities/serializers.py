from rest_framework import serializers
from .models import (
    Community, CommunityMembership, CommunityInvite,
    Challenge, ChallengeParticipant
)
from Users.serializers import UserMinimalSerializer
from .models import ChallengeRouteWaypoint


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
            status=Challenge.Status.ACTIVE
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
        
# ─── Challenge Serializers ────────────────────────────────────────────────────

from .models import Challenge, ChallengeParticipant, ChallengeContribution


class ChallengeCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Challenge
        fields = [
            'id', 'title', 'description', 'challenge_type',
            'contribution_scope', 'activity_types', 'target_value',
            'target_unit', 'start_date', 'end_date',
        ]
        read_only_fields = ['id']

    def validate(self, data):
        if data['start_date'] >= data['end_date']:
            raise serializers.ValidationError('End date must be after start date.')
        if data['target_value'] <= 0:
            raise serializers.ValidationError('Target value must be positive.')
        if not data.get('activity_types'):
            raise serializers.ValidationError('At least one activity type is required.')
        valid_types = ['run', 'walk', 'cycle', 'hike']
        for t in data['activity_types']:
            if t not in valid_types:
                raise serializers.ValidationError(f'Invalid activity type: {t}')
        return data


class ChallengeContributionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='participant.user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    activity_title = serializers.CharField(source='activity.title', read_only=True)
    activity_type = serializers.CharField(source='activity.activity_type', read_only=True)

    class Meta:
        model = ChallengeContribution
        fields = [
            'id', 'username', 'full_name', 'activity_title',
            'activity_type', 'value', 'contributed_at',
        ]

    def get_full_name(self, obj):
        return obj.participant.user.get_full_name()


class ChallengeParticipantSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    full_name = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = ChallengeParticipant
        fields = [
            'id', 'user_id', 'username', 'full_name',
            'joined_at', 'total_contributed', 'is_completed',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name()


# RouteWaypointSerializer MUST be declared BEFORE ChallengeDetailSerializer
class RouteWaypointSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChallengeRouteWaypoint
        fields = [
            'id', 'order', 'waypoint_type', 'latitude',
            'longitude', 'name', 'radius_meters',
        ]
        read_only_fields = ['id']


class RouteWaypointCreateSerializer(serializers.Serializer):
    """For incoming waypoint data when creating a route challenge."""
    order = serializers.IntegerField()
    waypoint_type = serializers.ChoiceField(
        choices=ChallengeRouteWaypoint.WaypointType.choices
    )
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    # ── THE FIX: allow_blank=True so empty waypoint names don't cause 400 ──
    name = serializers.CharField(max_length=200, required=False, default='', allow_blank=True)
    radius_meters = serializers.IntegerField(required=False, default=50)


class ChallengeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing challenges."""
    participants_count = serializers.IntegerField(read_only=True)
    total_progress = serializers.FloatField(read_only=True)
    progress_percentage = serializers.FloatField(read_only=True)
    current_status = serializers.CharField(read_only=True)
    is_joined = serializers.SerializerMethodField()
    created_by_username = serializers.CharField(
        source='created_by.username', read_only=True
    )
    community_name = serializers.CharField(source='community.name', read_only=True)
    community_id = serializers.IntegerField(source='community.id', read_only=True)

    class Meta:
        model = Challenge
        fields = [
            'id', 'title', 'description', 'challenge_type',
            'contribution_scope', 'activity_types', 'target_value',
            'target_unit', 'start_date', 'end_date', 'status',
            'current_status', 'participants_count', 'total_progress',
            'progress_percentage', 'is_joined', 'created_by_username',
            'created_at', 'community_name', 'community_id', 'is_route_challenge',
        ]

    def get_is_joined(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.participants.filter(user=request.user).exists()
        return False


class ChallengeDetailSerializer(ChallengeListSerializer):
    """Full detail with leaderboard."""
    leaderboard = serializers.SerializerMethodField()
    my_progress = serializers.SerializerMethodField()
    recent_contributions = serializers.SerializerMethodField()
    # ── THE FIX: explicitly declare the nested serializer field ──
    route_waypoints = RouteWaypointSerializer(many=True, read_only=True)

    class Meta(ChallengeListSerializer.Meta):
        fields = ChallengeListSerializer.Meta.fields + [
            'leaderboard', 'my_progress', 'recent_contributions', 'route_waypoints',
        ]

    def get_leaderboard(self, obj):
        top_participants = obj.participants.order_by('-total_contributed')[:20]
        return ChallengeParticipantSerializer(top_participants, many=True).data

    def get_my_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        participant = obj.participants.filter(user=request.user).first()
        if not participant:
            return None
        return {
            'total_contributed': participant.total_contributed,
            'is_completed': participant.is_completed,
            'joined_at': participant.joined_at,
            'percentage': min(
                round(participant.total_contributed / obj.target_value * 100, 1),
                100,
            ) if obj.target_value > 0 else 0,
        }

    def get_recent_contributions(self, obj):
        recent = obj.contributions.order_by('-contributed_at')[:10]
        return ChallengeContributionSerializer(recent, many=True).data