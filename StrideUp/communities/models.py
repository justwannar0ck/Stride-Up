from django.contrib.gis.db import models
from django.conf import settings
from django.utils import timezone


class Community(models.Model):
    """
    A community/club that users can create or join.
    Leaders can later create challenges within the community.
    """
    
    class Visibility(models.TextChoices):
        PUBLIC = 'public', 'Public'           # Anyone can find and join
        PRIVATE = 'private', 'Private'        # Invite only / request to join
    
    # Basic info
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(max_length=1000, blank=True)
    cover_image = models.URLField(max_length=500, blank=True)
    icon_image = models.URLField(max_length=500, blank=True)
    
    # Settings
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PUBLIC
    )
    max_members = models.PositiveIntegerField(
        default=500,
        help_text="Maximum number of members allowed"
    )
    
    # Activity types this community focuses on (optional filter)
    activity_types = models.JSONField(
        default=list,
        blank=True,
        help_text="List of activity types: ['run', 'walk', 'cycle', 'hike']"
    )
    
    # Creator / ownership
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_communities'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Communities'
    
    def __str__(self):
        return self.name
    
    @property
    def members_count(self):
        return self.memberships.filter(
            status=CommunityMembership.Status.ACTIVE
        ).count()


class CommunityMembership(models.Model):
    """
    Tracks a user's membership in a community, including their role.
    """
    
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'          # Full control, can delete community
        ADMIN = 'admin', 'Admin'          # Can manage members, settings, create challenges
        MODERATOR = 'moderator', 'Moderator'  # Can manage posts, mute members
        MEMBER = 'member', 'Member'       # Regular participant
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PENDING = 'pending', 'Pending'      # Awaiting approval (private communities)
        BANNED = 'banned', 'Banned'
        LEFT = 'left', 'Left'
    
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_memberships'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MEMBER
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('community', 'user')
        ordering = ['joined_at']
        indexes = [
            models.Index(fields=['community', 'status']),
            models.Index(fields=['user', 'status']),
        ]
    
    def __str__(self):
        return f"{self.user.username} in {self.community.name} ({self.role})"
    
    @property
    def can_manage_members(self):
        return self.role in [self.Role.OWNER, self.Role.ADMIN]
    
    @property
    def can_create_challenges(self):
        """Only owners and admins can create challenges"""
        return self.role in [self.Role.OWNER, self.Role.ADMIN]
    
    @property
    def can_moderate(self):
        return self.role in [self.Role.OWNER, self.Role.ADMIN, self.Role.MODERATOR]


class CommunityInvite(models.Model):
    """
    Invitations to join a community (for private communities).
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        DECLINED = 'declined', 'Declined'
        EXPIRED = 'expired', 'Expired'
    
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='invites'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_community_invites'
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_community_invites'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this invite expires"
    )
    
    class Meta:
        unique_together = ('community', 'invited_user')
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Invite for {self.invited_user.username} to {self.community.name}"


# ──────────────────────────────────────────────────────────────────────
# PLACEHOLDER for future Challenge feature — kept here so the schema
# is designed with it in mind. DO NOT implement logic yet.
# ──────────────────────────────────────────────────────────────────────

class CommunityChallenge(models.Model):
    """
    A challenge created within a community by an admin/owner.
    Members contribute via their activities.
    (Placeholder — full implementation in a future sprint)
    """
    
    class ChallengeType(models.TextChoices):
        TOTAL_DISTANCE = 'total_distance', 'Total Distance'
        TOTAL_DURATION = 'total_duration', 'Total Duration'
        TOTAL_ELEVATION = 'total_elevation', 'Total Elevation Gain'
        ACTIVITY_COUNT = 'activity_count', 'Activity Count'
        CALORIES = 'calories', 'Calories Burned'
    
    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'
    
    community = models.ForeignKey(
        Community,
        on_delete=models.CASCADE,
        related_name='challenges'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_challenges'
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    challenge_type = models.CharField(
        max_length=30,
        choices=ChallengeType.choices,
        default=ChallengeType.TOTAL_DISTANCE
    )
    
    # Target value (e.g., 500 km, 100 activities, etc.)
    target_value = models.FloatField(
        help_text="The goal value for this challenge"
    )
    
    # Which activity types count toward this challenge
    allowed_activity_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Activity types that count: ['run', 'walk', 'cycle', 'hike']. Empty = all."
    )
    
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING
    )
    
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-starts_at']
    
    def __str__(self):
        return f"{self.title} ({self.community.name})"


class ChallengeParticipation(models.Model):
    """
    Tracks individual member contributions to a challenge.
    (Placeholder — full implementation in a future sprint)
    """
    
    challenge = models.ForeignKey(
        CommunityChallenge,
        on_delete=models.CASCADE,
        related_name='participations'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_participations'
    )
    
    # Aggregated contribution
    contributed_value = models.FloatField(default=0)
    activities_count = models.PositiveIntegerField(default=0)
    
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('challenge', 'user')
        ordering = ['-contributed_value']
    
    def __str__(self):
        return f"{self.user.username}'s contribution to {self.challenge.title}"