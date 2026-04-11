from django.db import models
from django.conf import settings

class RankTier(models.Model):
    """
    Defines the gamification ranks/tiers users can achieve based on lifetime points.
    """
    name = models.CharField(max_length=50, unique=True, help_text="e.g., Bronze, Silver, Gold")
    min_lifetime_points = models.PositiveIntegerField(unique=True, help_text="Points required to reach this tier")
    color_hex = models.CharField(max_length=7, default="#FFD700", help_text="Hex color code for the banner (e.g., #FFD700)")
    icon_name = models.CharField(max_length=50, default="medal-outline", help_text="Ionicons name for the frontend")

    class Meta:
        ordering = ['min_lifetime_points']
        verbose_name = 'Rank Tier'
        verbose_name_plural = 'Rank Tiers'

    def __str__(self):
        return f"{self.name} ({self.min_lifetime_points}+ pts)"


class PointBalance(models.Model):
    """
    Tracks each user's total available points.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='point_balance'
    )
    balance = models.PositiveIntegerField(default=0)
    lifetime_earned = models.PositiveIntegerField(
        default=0
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Point Balance'
        verbose_name_plural = 'Point Balances'

    def __str__(self):
        return f"{self.user.username}: {self.balance} pts"

    def add_points(self, amount, reason, activity=None):
        """Awards points and creates a transaction record."""
        self.balance += amount
        self.lifetime_earned += amount
        self.save()

        return PointTransaction.objects.create(
            user=self.user,
            amount=amount,
            transaction_type=PointTransaction.TransactionType.EARNED,
            reason=reason,
            activity=activity,
            balance_after=self.balance,
        )

    def get_tier_info(self):
        """Calculates current tier, next tier, and progress percentage based on lifetime points."""
        tiers = list(RankTier.objects.all().order_by('min_lifetime_points'))
        
        # Fallback if no tiers exist in the database yet
        if not tiers:
            return None

        current_tier = tiers[0]
        next_tier = None

        for i, tier in enumerate(tiers):
            if self.lifetime_earned >= tier.min_lifetime_points:
                current_tier = tier
                if i + 1 < len(tiers):
                    next_tier = tiers[i + 1]
                else:
                    next_tier = None  # User reached the maximum tier
            else:
                break

        progress_percentage = 100.0
        if next_tier:
            points_needed = next_tier.min_lifetime_points - current_tier.min_lifetime_points
            points_progress = self.lifetime_earned - current_tier.min_lifetime_points
            if points_needed > 0:
                progress_percentage = min((points_progress / points_needed) * 100, 100.0)

        return {
            "current_tier": current_tier,
            "next_tier": next_tier,
            "progress_percentage": round(progress_percentage, 1)
        }


class PointTransaction(models.Model):
    """
    All point earning events.
    """

    class TransactionType(models.TextChoices):
        EARNED = 'earned', 'Earned'
        BONUS = 'bonus', 'Bonus'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='point_transactions'
    )
    amount = models.PositiveIntegerField(default=0)
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
    )
    reason = models.CharField(
        default=0,
        max_length=255
    )
    activity = models.ForeignKey(
        'activities.Activity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='point_transactions',
    )
    balance_after = models.PositiveIntegerField(
        default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type']),
        ]

    def __str__(self):
        return f"{self.user.username} +{self.amount} pts — {self.reason}"