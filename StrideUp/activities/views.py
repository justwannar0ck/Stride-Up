from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum, Avg, Max, Min, Count
from datetime import timedelta
from .models import Activity, GPSPoint, ActivityPause
from .serializers import (
    ActivityCreateSerializer,
    ActivityUpdateSerializer,
    ActivityListSerializer,
    ActivityDetailSerializer,
    ActivityCompleteSerializer,
    GPSBatchUploadSerializer,
    ActivityPauseSerializer,
)


class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing activities.
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Activity.objects.filter(user=self.request.user)
    
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