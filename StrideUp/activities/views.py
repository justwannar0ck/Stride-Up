from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum, Avg, Max, Min, Count, Q
from datetime import timedelta
from .models import Activity, GPSPoint, ActivityPause, ActivityLike
from .serializers import (
    ActivityCreateSerializer,
    ActivityUpdateSerializer,
    ActivityListSerializer,
    ActivityDetailSerializer,
    ActivityCompleteSerializer,
    GPSBatchUploadSerializer,
    ActivityPauseSerializer,
)
from Users.models import Follow


class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing activities.
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # For list action, only show user's own activities
        if self.action == 'list':
            return Activity.objects.filter(user=user)
        
        # For retrieve (detail view), allow viewing:
        # 1. Own activities
        # 2. Public activities
        # 3. Followers-only activities from users we follow
        if self.action == 'retrieve':
            following_ids = Follow.objects.filter(
                follower=user
            ).values_list('following_id', flat=True)
            
            return Activity.objects.filter(
                Q(user=user) |  # Own activities
                Q(visibility=Activity.Visibility.PUBLIC, status=Activity.Status.COMPLETED) |  # Public
                Q(
                    visibility=Activity.Visibility.FOLLOWERS,
                    status=Activity.Status.COMPLETED,
                    user_id__in=following_ids
                )  # Followers-only from people we follow
            )
        
        # For other actions (update, delete, etc.), only own activities
        return Activity.objects.filter(user=user)
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ActivityCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ActivityUpdateSerializer
        elif self.action == 'retrieve':
            return ActivityDetailSerializer
        return ActivityListSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        activity = serializer.save()
        
        return Response({
            'id': activity.id,
            'activity_type': activity.activity_type,
            'status': activity.status,
            'started_at': activity.started_at,
            'message': 'Activity started successfully'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        activity = self.get_object()
        
        if activity.status != Activity.Status.IN_PROGRESS:
            return Response(
                {'error': 'Can only pause an in-progress activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        ActivityPause.objects.create(
            activity=activity,
            paused_at=timezone.now()
        )
        
        activity.status = Activity.Status.PAUSED
        activity.save()
        
        return Response({
            'status': activity.status,
            'message': 'Activity paused'
        })
    
    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        activity = self.get_object()
        
        if activity.status != Activity.Status.PAUSED:
            return Response(
                {'error': 'Can only resume a paused activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        latest_pause = activity.pauses.filter(resumed_at__isnull=True).last()
        if latest_pause:
            latest_pause.resumed_at = timezone.now()
            latest_pause.save()
        
        activity.status = Activity.Status.IN_PROGRESS
        activity.save()
        
        return Response({
            'status': activity.status,
            'message': 'Activity resumed'
        })
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        activity = self.get_object()
        
        if activity.status not in [Activity.Status.IN_PROGRESS, Activity.Status.PAUSED]:
            return Response(
                {'error': 'Can only complete an active or paused activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = ActivityCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        for field, value in serializer.validated_data.items():
            setattr(activity, field, value)
        
        # Close any open pauses
        open_pauses = activity.pauses.filter(resumed_at__isnull=True)
        for pause in open_pauses:
            pause.resumed_at = timezone.now()
            pause.save()
        
        activity.finished_at = timezone.now()
        activity.status = Activity.Status.COMPLETED
        activity.save()
        
        # Calculate all statistics
        activity.calculate_statistics()
        
        detail_serializer = ActivityDetailSerializer(activity)
        return Response(detail_serializer.data)
    
    @action(detail=True, methods=['post'])
    def discard(self, request, pk=None):
        activity = self.get_object()
        
        if activity.status == Activity.Status.COMPLETED:
            return Response(
                {'error': 'Cannot discard a completed activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        activity.status = Activity.Status.DISCARDED
        activity.save()
        
        return Response({
            'status': activity.status,
            'message': 'Activity discarded'
        })
    
    @action(detail=False, methods=['post'])
    def upload_gps(self, request):
        serializer = GPSBatchUploadSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        
        return Response({
            'activity_id': result['activity_id'],
            'points_added': result['points_added'],
            'message': 'GPS points uploaded successfully'
        })
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        activity = Activity.objects.filter(
            user=request.user,
            status__in=[Activity.Status.IN_PROGRESS, Activity.Status.PAUSED]
        ).first()
        
        if activity:
            serializer = ActivityDetailSerializer(activity)
            return Response(serializer.data)
        
        return Response({'message': 'No active activity'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like/give kudos to an activity."""
        activity = self.get_object()
        
        # Can't like your own activity
        if activity.user == request.user:
            return Response(
                {'error': 'You cannot like your own activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already liked
        from .models import ActivityLike
        like, created = ActivityLike.objects.get_or_create(
            activity=activity,
            user=request.user
        )
        
        if not created:
            return Response(
                {'error': 'You have already liked this activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'message': 'Activity liked',
            'likes_count': activity.likes.count()
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def unlike(self, request, pk=None):
        """Remove like/kudos from an activity."""
        activity = self.get_object()
        
        from .models import ActivityLike
        deleted, _ = ActivityLike.objects.filter(
            activity=activity,
            user=request.user
        ).delete()
        
        if deleted:
            return Response({
                'message': 'Like removed',
                'likes_count': activity.likes.count()
            })
        
        return Response(
            {'error': 'You have not liked this activity'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['get'])
    def likes(self, request, pk=None):
        """Get list of users who liked an activity."""
        activity = self.get_object()
        
        from .models import ActivityLike
        likes = ActivityLike.objects.filter(activity=activity).select_related('user')
        
        users = []
        for like in likes:
            users.append({
                'id': like.user.id,
                'username': like.user.username,
                'full_name': like.user.get_full_name(),
                'profile_picture': None,
                'liked_at': like.created_at.isoformat(),
            })
        
        return Response({
            'count': len(users),
            'results': users
        })


class UserStatisticsView(APIView):
    """
    Get user's overall activity statistics.
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        completed_activities = Activity.objects.filter(
            user=user,
            status=Activity.Status.COMPLETED
        )
        
        # Basic aggregations
        stats = completed_activities.aggregate(
            total_activities=Count('id'),
            total_distance=Sum('distance'),
            total_duration=Sum('duration'),
            total_calories=Sum('calories_burned'),
            total_elevation=Sum('elevation_gain'),
            avg_pace=Avg('average_pace'),
            avg_speed=Avg('average_speed'),
            max_distance=Max('distance'),
            max_duration=Max('duration'),
            min_pace=Min('average_pace'),
        )
        
        # This week's stats
        week_start = timezone.now() - timedelta(days=timezone.now().weekday())
        this_week = completed_activities.filter(
            started_at__gte=week_start
        ).aggregate(distance=Sum('distance'))
        
        # This month's stats
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0)
        this_month = completed_activities.filter(
            started_at__gte=month_start
        ).aggregate(distance=Sum('distance'))
        
        # By activity type
        by_type = {}
        for activity_type in Activity.ActivityType.values:
            type_stats = completed_activities.filter(
                activity_type=activity_type
            ).aggregate(
                count=Count('id'),
                distance=Sum('distance'),
                duration=Sum('duration')
            )
            if type_stats['count'] > 0:
                by_type[activity_type] = {
                    'count': type_stats['count'],
                    'distance_km': round((type_stats['distance'] or 0) / 1000, 2),
                    'duration_hours': round(
                        (type_stats['duration'].total_seconds() if type_stats['duration'] else 0) / 3600, 2
                    )
                }
        
        def format_pace(seconds):
            if not seconds:
                return "--:--"
            minutes = int(seconds // 60)
            secs = int(seconds % 60)
            return f"{minutes}:{secs:02d}"
        
        def format_duration(duration):
            if not duration:
                return "0:00:00"
            total_secs = int(duration.total_seconds())
            hours = total_secs // 3600
            minutes = (total_secs % 3600) // 60
            seconds = total_secs % 60
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        
        response_data = {
            'total_activities': stats['total_activities'] or 0,
            'total_distance_km': round((stats['total_distance'] or 0) / 1000, 2),
            'total_duration_hours': round(
                (stats['total_duration'].total_seconds() if stats['total_duration'] else 0) / 3600, 2
            ),
            'total_calories': round(stats['total_calories'] or 0, 0),
            'total_elevation_gain': round(stats['total_elevation'] or 0, 0),
            'average_pace': format_pace(stats['avg_pace']),
            'average_speed': round(stats['avg_speed'] or 0, 2),
            'activities_by_type': by_type,
            'this_week_distance_km': round((this_week['distance'] or 0) / 1000, 2),
            'this_month_distance_km': round((this_month['distance'] or 0) / 1000, 2),
            'personal_bests': {
                'longest_distance_km': round((stats['max_distance'] or 0) / 1000, 2),
                'longest_duration': format_duration(stats['max_duration']),
                'fastest_pace': format_pace(stats['min_pace']),
            }
        }
        
        return Response(response_data)
    
class FeedView(APIView):
    """
    Get activity feed from users the current user follows.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Get list of user IDs that the current user follows
        following_ids = Follow.objects.filter(
            follower=user
        ).values_list('following_id', flat=True)
        
        # Get activities from followed users
        activities = Activity.objects.filter(
            Q(user_id__in=following_ids) & 
            Q(status=Activity.Status.COMPLETED) &
            (
                Q(visibility=Activity.Visibility.PUBLIC) |
                Q(visibility=Activity.Visibility.FOLLOWERS)
            )
        ).select_related('user').prefetch_related('likes').order_by('-started_at')
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        offset = (page - 1) * limit
        
        total_count = activities.count()
        activities_page = activities[offset:offset + limit]
        
        # Serialize the activities
        serialized_activities = []
        for activity in activities_page:
            serialized_activities.append({
                'id': activity.id,
                'user': {
                    'id': activity.user.id,
                    'username': activity.user.username,
                    'full_name': activity.user.get_full_name(),
                    'profile_picture': None,
                },
                'title': activity.title,
                'description': activity.description,
                'activity_type': activity.activity_type,
                'distance_km': activity.distance_km,
                'duration_formatted': activity.duration_formatted,
                'pace_formatted': activity.pace_formatted,
                'elevation_gain': activity.elevation_gain,
                'calories_burned': activity.calories_burned,
                'started_at': activity.started_at.isoformat(),
                'visibility': activity.visibility,
                'route_geojson': activity.get_route_for_display() if not activity.hide_start_end else None,
                'likes_count': activity.likes.count(),
                'is_liked': activity.likes.filter(user=user).exists(),
            })
        
        return Response({
            'count': total_count,
            'page': page,
            'limit': limit,
            'has_more': offset + limit < total_count,
            'results': serialized_activities,
        })
        
class ActivityLikeView(APIView):
    """Handle liking/unliking activities."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_activity(self, pk, user):
        """Get activity if user has permission to view it."""
        following_ids = Follow.objects.filter(
            follower=user
        ).values_list('following_id', flat=True)
        
        try:
            return Activity.objects.get(
                Q(pk=pk) & (
                    Q(user=user) |
                    Q(visibility=Activity.Visibility.PUBLIC, status=Activity.Status.COMPLETED) |
                    Q(
                        visibility=Activity.Visibility.FOLLOWERS,
                        status=Activity.Status.COMPLETED,
                        user_id__in=following_ids
                    )
                )
            )
        except Activity.DoesNotExist:
            return None
    
    def post(self, request, pk):
        """Like an activity."""
        activity = self.get_activity(pk, request.user)
        
        if not activity:
            return Response(
                {'error': 'Activity not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Can't like your own activity
        if activity.user == request.user:
            return Response(
                {'error': 'You cannot like your own activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already liked
        like, created = ActivityLike.objects.get_or_create(
            activity=activity,
            user=request.user
        )
        
        if not created:
            return Response(
                {'error': 'You have already liked this activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'message': 'Activity liked',
            'likes_count': activity.likes.count()
        }, status=status.HTTP_201_CREATED)
    
    def delete(self, request, pk):
        """Unlike an activity."""
        activity = self.get_activity(pk, request.user)
        
        if not activity:
            return Response(
                {'error': 'Activity not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        deleted, _ = ActivityLike.objects.filter(
            activity=activity,
            user=request.user
        ).delete()
        
        if deleted:
            return Response({
                'message': 'Like removed',
                'likes_count': activity.likes.count()
            })
        
        return Response(
            {'error': 'You have not liked this activity'},
            status=status.HTTP_400_BAD_REQUEST
        )


class ActivityLikesListView(APIView):
    """Get list of users who liked an activity."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, pk):
        try:
            activity = Activity.objects.get(pk=pk)
        except Activity.DoesNotExist:
            return Response(
                {'error': 'Activity not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        likes = ActivityLike.objects.filter(activity=activity).select_related('user')
        
        users = []
        for like in likes:
            users.append({
                'id': like.user.id,
                'username': like.user.username,
                'full_name': like.user.get_full_name(),
                'profile_picture': None,
                'liked_at': like.created_at.isoformat(),
            })
        
        return Response({
            'count': len(users),
            'results': users
        })