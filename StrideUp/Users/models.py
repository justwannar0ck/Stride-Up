from django.contrib.auth.models import AbstractUser
from django.contrib.gis.db import models
from django.conf import settings


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Includes additional fields for fitness tracking app.
    """
    
    # Additional profile fields
    bio = models.TextField(max_length=500, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    profile_picture = models.URLField(max_length=500, blank=True)
    
    # Privacy settings
    is_private = models.BooleanField(default=False)
    
    # User's home location (optional - for nearby features and privacy zones)
    home_location = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True,
        help_text="User's home location for privacy zones"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.username
    
    def get_full_name(self):
        """Return the user's full name."""
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name if full_name else self.username
    
    @property
    def followers_count(self):
        """Return the number of followers."""
        return self.followers.count()
    
    @property
    def following_count(self):
        """Return the number of users this user is following."""
        return self.following.count()
    
    def is_following(self, user):
        """Check if this user is following the given user."""
        return self.following.filter(following=user).exists()
    
    def is_followed_by(self, user):
        """Check if this user is followed by the given user."""
        return self.followers.filter(follower=user).exists()
    
    def has_pending_follow_request_from(self, user):
        """Check if there's a pending follow request from the given user."""
        return self.received_follow_requests.filter(
            from_user=user, 
            status=FollowRequest.Status.PENDING
        ).exists()
    
    def has_pending_follow_request_to(self, user):
        """Check if this user has sent a pending follow request to the given user."""
        return self.sent_follow_requests.filter(
            to_user=user,
            status=FollowRequest.Status.PENDING
        ).exists()


class Follow(models.Model):
    """
    Model to track follow relationships between users.
    """
    
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following',
        help_text="The user who is following"
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers',
        help_text="The user being followed"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('follower', 'following')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['follower', 'following']),
            models.Index(fields=['following', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.follower == self.following:
            raise ValidationError("Users cannot follow themselves.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class FollowRequest(models.Model):
    """
    Model to track pending follow requests for private accounts.
    """
    
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'
        REJECTED = 'rejected', 'Rejected'
    
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_follow_requests',
        help_text="The user who sent the follow request"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_follow_requests',
        help_text="The user who received the follow request"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('from_user', 'to_user')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['to_user', 'status']),
            models.Index(fields=['from_user', 'status']),
        ]
    
    def __str__(self):
        return f"{self.from_user.username} -> {self.to_user.username} ({self.status})"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        if self.from_user == self.to_user:
            raise ValidationError("Users cannot send follow requests to themselves.")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
    
    def accept(self):
        """Accept the follow request and create a Follow relationship."""
        if self.status != self.Status.PENDING:
            return False
        
        # Create the follow relationship
        Follow.objects.get_or_create(
            follower=self.from_user,
            following=self.to_user
        )
        
        self.status = self.Status.ACCEPTED
        self.save()
        return True
    
    def reject(self):
        """Reject the follow request."""
        if self.status != self.Status.PENDING:
            return False
        
        self.status = self.Status.REJECTED
        self.save()
        return True