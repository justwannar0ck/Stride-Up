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

# ─── Challenge Models ─────────────────────────────────────────────────────────

class Challenge(models.Model):
    """
    A challenge created within a community that members can join and contribute to.
    Contributions happen automatically when a matching activity is completed.
    """

    class ChallengeType(models.TextChoices):
        DISTANCE = 'distance', 'Distance'
        DURATION = 'duration', 'Duration'
        COUNT = 'count', 'Activity Count'
        ELEVATION = 'elevation', 'Elevation'

    class ContributionScope(models.TextChoices):
        COLLECTIVE = 'collective', 'Collective'
        INDIVIDUAL = 'individual', 'Individual'

    class Status(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        CANCELLED = 'cancelled', 'Cancelled'

    community = models.ForeignKey(
        'Community',
        on_delete=models.CASCADE,
        related_name='challenges',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_challenges',
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    challenge_type = models.CharField(
        max_length=20,
        choices=ChallengeType.choices,
    )
    contribution_scope = models.CharField(
        max_length=20,
        choices=ContributionScope.choices,
    )

    # Which activity types qualify (stored as JSON list, e.g. ["run","walk"])
    activity_types = models.JSONField(
        default=list,
        help_text='List of activity types that qualify, e.g. ["run","walk"]',
    )

    target_value = models.FloatField(
        help_text='Goal number (km, hours, count, or meters depending on type)',
    )
    target_unit = models.CharField(
        max_length=20,
        help_text='Display unit: km, hours, activities, meters',
    )

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.UPCOMING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Route challenge flag
    is_route_challenge = models.BooleanField(
        default=False,
        help_text='Whether this is a route-based challenge with waypoints',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['community', 'status']),
            models.Index(fields=['start_date', 'end_date']),
        ]

    def __str__(self):
        return f"{self.title} ({self.community.name})"

    @property
    def current_status(self):
        """Compute the real-time status based on dates."""
        from django.utils import timezone
        now = timezone.now()
        if self.status == self.Status.CANCELLED:
            return self.Status.CANCELLED
        if now < self.start_date:
            return self.Status.UPCOMING
        if now > self.end_date:
            return self.Status.COMPLETED
        return self.Status.ACTIVE

    def sync_status(self):
        """Update status field to match current_status. Call via cron or on access."""
        computed = self.current_status
        if self.status != computed and self.status != self.Status.CANCELLED:
            self.status = computed
            self.save(update_fields=['status'])

    @property
    def total_progress(self):
        """Sum of all contributions to this challenge."""
        return self.contributions.aggregate(
            total=models.Sum('value')
        )['total'] or 0

    @property
    def progress_percentage(self):
        if self.target_value <= 0:
            return 0
        if self.contribution_scope == self.ContributionScope.COLLECTIVE:
            return min(round(self.total_progress / self.target_value * 100, 1), 100)
        return 0  # For individual, percentage is per-participant

    @property
    def participants_count(self):
        return self.participants.count()


class ChallengeParticipant(models.Model):
    """
    Tracks which users have joined a challenge.
    """
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_participations',
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    total_contributed = models.FloatField(
        default=0,
        help_text='Running total of this user\'s contributions',
    )
    is_completed = models.BooleanField(
        default=False,
        help_text='Whether this participant hit the individual target',
    )

    class Meta:
        unique_together = ('challenge', 'user')
        ordering = ['-total_contributed']

    def __str__(self):
        return f"{self.user.username} in {self.challenge.title}"

    def update_total(self):
        """Recalculate total_contributed from contributions."""
        total = self.contributions.aggregate(
            total=models.Sum('value')
        )['total'] or 0
        self.total_contributed = total
        # Checks individual completion
        if self.challenge.contribution_scope == Challenge.ContributionScope.INDIVIDUAL:
            self.is_completed = total >= self.challenge.target_value
        self.save(update_fields=['total_contributed', 'is_completed'])


class ChallengeContribution(models.Model):
    """
    A single contribution to a challenge, linked to a specific activity.
    Created automatically when a qualifying activity is completed.
    """
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name='contributions',
    )
    participant = models.ForeignKey(
        ChallengeParticipant,
        on_delete=models.CASCADE,
        related_name='contributions',
    )
    activity = models.ForeignKey(
        'activities.Activity',
        on_delete=models.CASCADE,
        related_name='challenge_contributions',
    )
    value = models.FloatField(
        help_text='The contributed amount (km, hours, 1, or meters)',
    )
    contributed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevent the same activity counting twice for the same challenge
        unique_together = ('challenge', 'activity')
        ordering = ['-contributed_at']

    def __str__(self):
        return f"{self.participant.user.username}: {self.value} for {self.challenge.title}"

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

class ChallengeRouteWaypoint(models.Model):
    """
    An ordered waypoint (start, checkpoint, or end) on a route challenge.
    The admin places these when creating the challenge.
    """
    
    class WaypointType(models.TextChoices):
        START = 'start', 'Start'
        CHECKPOINT = 'checkpoint', 'Checkpoint'
        END = 'end', 'End'
    
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name='route_waypoints',
    )
    
    # Order in the route (0 = start, last = end)
    order = models.PositiveIntegerField()
    
    waypoint_type = models.CharField(
        max_length=20,
        choices=WaypointType.choices,
    )
    
    # The actual location
    latitude = models.FloatField()
    longitude = models.FloatField()
    
    # Optional: human-readable name the admin typed/selected
    name = models.CharField(
        max_length=200,
        blank=True,
        help_text='e.g. "Thamel Gate", "Ratna Park", typed or from geocoding',
    )
    
    # Radius in meters — how close a user must pass to "clear" this checkpoint
    radius_meters = models.PositiveIntegerField(
        default=50,
        help_text='How close (in meters) a user must be to register as reached',
    )
    
    class Meta:
        ordering = ['order']
        unique_together = ('challenge', 'order')
    
    def __str__(self):
        return f"{self.waypoint_type}: {self.name or f'({self.latitude}, {self.longitude})'} (#{self.order})"