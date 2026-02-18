from django.db.models import Sum, Count, Avg, Q
from activities.models import Activity
from .models import CommunityMembership

def get_community_stats(community, period_start=None, period_end=None):
    """
    Get aggregated activity stats for all active members.
    This same logic will be reused for challenge progress tracking.
    """
    member_ids = community.memberships.filter(
        status=CommunityMembership.Status.ACTIVE
    ).values_list('user_id', flat=True)
    
    activities = Activity.objects.filter(
        user_id__in=member_ids,
        status=Activity.Status.COMPLETED,
    )
    
    if period_start:
        activities = activities.filter(started_at__gte=period_start)
    if period_end:
        activities = activities.filter(started_at__lte=period_end)
    
    stats = activities.aggregate(
        total_distance=Sum('distance'),          # meters
        total_duration=Sum('duration'),
        total_elevation_gain=Sum('elevation_gain'),
        total_calories=Sum('calories_burned'),
        total_activities=Count('id'),
        avg_distance=Avg('distance'),
        avg_pace=Avg('average_pace'),
    )
    
    # Per activity type breakdown
    by_type = (
        activities
        .values('activity_type')
        .annotate(
            count=Count('id'),
            distance=Sum('distance'),
            duration=Sum('duration'),
        )
    )
    
    stats['by_activity_type'] = list(by_type)
    stats['members_count'] = len(member_ids)
    
    return stats