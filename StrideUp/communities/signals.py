from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(pre_save, sender='activities.Activity')
def check_challenge_contributions(sender, instance, **kwargs):
    """
    When an activity transitions to 'completed', finds all active challenges
    that the user has joined and creates contributions automatically.
    
    Only activities completed AFTER the user joined the challenge counts.
    Past activities do NOT count for late joiners.
    """
    # Only triggers when status changes to 'completed'
    if not instance.pk:
        return  # New instance, not completed yet

    try:
        old_instance = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    # Check if transitioning to completed
    if old_instance.status == 'completed' or instance.status != 'completed':
        return

    # Defer the actual work to after the save completes
    from django.db.models.signals import post_save

    def _create_contributions(sender, instance, **kwargs):
        """Create contributions after the activity is fully saved."""
        # Disconnects to avoid recursion
        post_save.disconnect(_create_contributions, sender=sender)
        _process_contributions(instance)

    post_save.connect(_create_contributions, sender=sender)


def _process_contributions(activity):
    """
    Finds all qualifying challenges and create contribution records.
    """
    from .models import Challenge, ChallengeParticipant, ChallengeContribution

    user = activity.user

    # Finds all challenges where:
    # 1. User is a participant
    # 2. Challenge is active (within date range)
    # 3. Activity type matches the challenge's allowed types
    # 4. User joined the challenge BEFORE this activity was completed
    participants = ChallengeParticipant.objects.filter(
        user=user,
        challenge__status=Challenge.Status.ACTIVE,
        challenge__start_date__lte=activity.finished_at or timezone.now(),
        challenge__end_date__gte=activity.started_at,
        joined_at__lte=activity.finished_at or timezone.now(),
    ).select_related('challenge')

    for participant in participants:
        challenge = participant.challenge

        # Checks if the activity type qualifies
        if activity.activity_type not in challenge.activity_types:
            continue

        # Checks if this activity already contributed to this challenge
        if ChallengeContribution.objects.filter(
            challenge=challenge,
            activity=activity,
        ).exists():
            continue

        # Calculates the contribution value based on challenge type
        value = _get_contribution_value(challenge, activity)
        if value is None or value <= 0:
            continue

        # Creates the contribution
        ChallengeContribution.objects.create(
            challenge=challenge,
            participant=participant,
            activity=activity,
            value=value,
        )

        # Updates participant's running total
        participant.update_total()


def _get_contribution_value(challenge, activity):
    """
    Extracts the contribution value from the activity based on challenge type.
    
    Activity model stores:
    - distance: meters (float)
    - duration: DurationField (timedelta)
    - elevation_gain: meters (float)
    """
    if challenge.challenge_type == 'distance':
        # Converts meters to km
        return round((activity.distance or 0) / 1000, 2)

    elif challenge.challenge_type == 'duration':
        # Converts timedelta to hours
        if activity.duration:
            return round(activity.duration.total_seconds() / 3600, 2)
        return 0

    elif challenge.challenge_type == 'count':
        # Each completed activity counts as 1
        return 1

    elif challenge.challenge_type == 'elevation':
        # Elevation gain in meters
        return round(activity.elevation_gain or 0, 1)

    return None