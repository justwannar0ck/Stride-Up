from .models import PointBalance, PointTransaction


# Point Rules
POINTS_PER_KM = {
    'run': 10,
    'walk': 5,
    'cycle': 10,
    'hike': 10,
}

DURATION_BONUS = [
    # (minutes_threshold, bonus_points)
    (120, 50),
    (90, 30),
    (60, 15),
    (30, 5),
]

COMPLETION_BONUS = 5  # flat bonus for finishing any activity


def calculate_activity_points(activity):
    points = 0
    breakdown = []

    # Distance-based
    distance_km = (activity.distance or 0) / 1000
    per_km = POINTS_PER_KM.get(activity.activity_type, 5)
    distance_pts = int(distance_km * per_km)
    if distance_pts > 0:
        points += distance_pts
        breakdown.append(f"{distance_km:.1f}km × {per_km} = {distance_pts}pts")

    # Completion bonus
    points += COMPLETION_BONUS
    breakdown.append(f"Completion bonus: +{COMPLETION_BONUS}pts")

    # 3. Duration bonus
    if activity.duration:
        minutes = activity.duration.total_seconds() / 60
        for threshold, bonus in DURATION_BONUS:
            if minutes >= threshold:
                points += bonus
                breakdown.append(f"Duration bonus ({int(minutes)}min): +{bonus}pts")
                break

    # Elevation bonus
    if activity.elevation_gain and activity.elevation_gain > 0:
        elev_pts = int(activity.elevation_gain / 50)
        if elev_pts > 0:
            points += elev_pts
            breakdown.append(f"Elevation ({activity.elevation_gain:.0f}m): +{elev_pts}pts")

    return max(points, 1), breakdown


def award_activity_points(activity):
    # does'nt award twice for the same activity
    if PointTransaction.objects.filter(
        activity=activity,
        transaction_type=PointTransaction.TransactionType.EARNED,
    ).exists():
        return None

    points, breakdown = calculate_activity_points(activity)

    balance, _ = PointBalance.objects.get_or_create(user=activity.user)

    reason = f"Completed {activity.get_activity_type_display()}: {activity.title or 'Untitled'}"
    transaction = balance.add_points(points, reason, activity=activity)

    return {
        'points_earned': points,
        'breakdown': breakdown,
        'new_balance': balance.balance,
        'transaction_id': transaction.id,
    }