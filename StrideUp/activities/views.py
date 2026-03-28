from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Sum, Avg, Max, Min, Count, Q
from datetime import timedelta
from .models import Activity, GPSPoint, ActivityPause, ActivityLike, CoachChatMessage
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
import google.generativeai as genai
from django.conf import settings


class ActivityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing activities.
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # For list action, only shows user's own activities
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
        
        if activity.status == Activity.Status.COMPLETED:
            return Response(
                {'error': 'Activity already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Updates with any provided data from request
        serializer = ActivityCompleteSerializer(data=request.data)
        if serializer.is_valid():
            if serializer.validated_data.get('title'):
                activity.title = serializer.validated_data['title']
            if serializer.validated_data.get('description'):
                activity.description = serializer.validated_data['description']
            if serializer.validated_data.get('visibility'):
                activity.visibility = serializer.validated_data['visibility']
            if 'hide_start_end' in serializer.validated_data:
                activity.hide_start_end = serializer.validated_data['hide_start_end']
        
        # Saves the updates first
        activity.save()
        
        # Calculates statistics (this builds the route AND calculates stats)
        activity.calculate_statistics()
        
        # Marks as completed
        activity.status = Activity.Status.COMPLETED
        activity.finished_at = timezone.now()
        activity.save()
        
        from gamification.services import award_activity_points
        points_result = award_activity_points(activity)

        detail_serializer = ActivityDetailSerializer(activity, context={'request': request})
        response_data = detail_serializer.data

        if points_result:
            response_data['points_earned'] = points_result['points_earned']
            response_data['points_breakdown'] = points_result['breakdown']
            response_data['total_points'] = points_result['new_balance']

        return Response(response_data)
    
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
        
        # Can't like our own activity
        if activity.user == request.user:
            return Response(
                {'error': 'You cannot like your own activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Checks if already liked
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
        """Removes like/kudos from an activity."""
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
        """Gets list of users who liked an activity."""
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
    
    @action(detail=True, methods=['post', 'get'])
    def coach_chat(self, request, pk=None):
        """AI Coach chat tied to a specific activity"""
        activity = self.get_object()
        user = request.user
        
        # Security Check: Ensure this is the user's own activity
        if activity.user != user:
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

        # Handle GET: Return current conversation thread
        if request.method == 'GET':
            messages = CoachChatMessage.objects.filter(activity=activity).values('role', 'message', 'created_at')
            return Response({"history": list(messages)}, status=status.HTTP_200_OK)

        # Handle POST: Process new message
        user_message = request.data.get('message', '')
        if not user_message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch past history ONLY for this Activity Type (e.g., previous running questions)
        past_type_chats = CoachChatMessage.objects.filter(
            user=user, 
            activity__activity_type=activity.activity_type, 
            role='user'
        ).exclude(
            activity=activity # Exclude current session
        ).order_by('-created_at')[:5] 

        type_history_str = "\n".join([f"- {msg.message}" for msg in past_type_chats])
        if not type_history_str:
            type_history_str = "No previous history for this activity type."

        # Build Context Prompt using the updated User model fields
        system_prompt = f"""
        You are an expert {activity.activity_type} coach talking to {user.first_name or 'an athlete'}.
        
        USER PROFILE:
        - Experience: {user.experience_level or 'beginner'}
        - Weight: {user.weight_kg or 'Unknown'}kg, Height: {user.height_cm or 'Unknown'}cm
        - Medical/Injuries: {user.medical_conditions_or_injuries or 'None'}
        
        CURRENT ACTIVITY ({activity.activity_type}):
        - Distance: {activity.distance_km}km
        - Pace: {activity.pace_formatted}/km
        - Duration: {activity.duration_formatted}
        
        USER'S PAST CHAT HISTORY FOR {activity.activity_type.upper()}:
        {type_history_str}
        
        RULES:
        1. Keep answers concise (under 4 sentences) and highly encouraging.
        2. Use their past chat history to provide better, continuous advice for this specific sport.
        """

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_prompt
            )

            # Get the ongoing chat for THIS specific activity session to maintain context
            current_session_msgs = CoachChatMessage.objects.filter(activity=activity).order_by('created_at')
            history = [{"role": msg.role, "parts": [msg.message]} for msg in current_session_msgs]

            chat = model.start_chat(history=history)

            # Save the new user message to DB
            CoachChatMessage.objects.create(activity=activity, user=user, role='user', message=user_message)

            # Get AI Response
            response = chat.send_message(user_message)
            ai_reply = response.text.strip()

            # Save AI Response to DB
            CoachChatMessage.objects.create(activity=activity, user=user, role='model', message=ai_reply)

            return Response({"reply": ai_reply, "role": "model"}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Gemini Error: {e}")
            return Response({"error": "Failed to connect to AI Coach"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    @action(detail=False, methods=['post', 'get'])
    def general_chat(self, request):
        """Global AI Coach chat that knows the user's recent workout history."""
        user = request.user
        
        if request.method == 'GET':
            # Retrieve general chat history (where activity is Null)
            messages = CoachChatMessage.objects.filter(user=user, activity__isnull=True).values('role', 'message', 'created_at')
            return Response({"history": list(messages)}, status=status.HTTP_200_OK)

        user_message = request.data.get('message', '')
        if not user_message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Gets the last 5 completed activities of ANY type
        recent_activities = Activity.objects.filter(
            user=user, 
            status=Activity.Status.COMPLETED
        ).order_by('-started_at')[:5]

        # Formats them into a readable list for the AI
        activities_str = ""
        if recent_activities.exists():
            for act in recent_activities:
                date_str = act.started_at.strftime("%b %d") if act.started_at else "Recently"
                activities_str += f"- {date_str} [{act.activity_type.upper()}]: {act.distance_km}km in {act.duration_formatted}. Pace: {act.pace_formatted}/km.\n"
        else:
            activities_str = "No recent completed activities."

        # General System Prompt
        system_prompt = f"""
        You are an expert, encouraging general fitness coach talking to {user.first_name or 'an athlete'}.
        
        USER PROFILE:
        - Goal: {user.primary_goal or 'General Fitness'}
        - Experience: {user.experience_level or 'beginner'}
        - Weight: {user.weight_kg or 'Unknown'}kg, Height: {user.height_cm or 'Unknown'}cm
        - Medical/Injuries: {user.medical_conditions_or_injuries or 'None'}
        
        USER'S RECENT WORKOUT HISTORY (Max last 5 activities):
        {activities_str}
        
        RULES:
        1. Give expert advice on training, diet, recovery, or motivation.
        2. Look at their RECENT WORKOUT HISTORY to give highly personalized advice (e.g., if they ran a lot recently, suggest recovery).
        3. Keep answers concise (under 4 sentences) and highly encouraging.
        """

        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_prompt
            )

            # Gets past general chat history
            past_messages = CoachChatMessage.objects.filter(user=user, activity__isnull=True).order_by('created_at')
            history = [{"role": msg.role, "parts": [msg.message]} for msg in past_messages]

            chat = model.start_chat(history=history)

            # Saves user message
            CoachChatMessage.objects.create(user=user, role='user', message=user_message, activity=None)

            # Get AI Response
            response = chat.send_message(user_message)
            ai_reply = response.text.strip()

            # Saves AI reply
            CoachChatMessage.objects.create(user=user, role='model', message=ai_reply, activity=None)

            return Response({"reply": ai_reply, "role": "model"}, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"Gemini Error: {e}")
            return Response({"error": "Failed to connect to AI Coach"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UserStatisticsView(APIView):
    """
    Gets user's overall activity statistics.
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
        
        # By activity types
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
    Gets activity feed from users the current user follows.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        # Gets list of user IDs that the current user follows
        following_ids = Follow.objects.filter(
            follower=user
        ).values_list('following_id', flat=True)
        
        # Gets activities from followed users
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
        
        # Serializes the activities
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
    """Handles liking/unliking activities."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_activity(self, pk, user):
        """Gets activity if user has permission to view it."""
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
        """Likes an activity."""
        activity = self.get_activity(pk, request.user)
        
        if not activity:
            return Response(
                {'error': 'Activity not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Can't like our own activity
        if activity.user == request.user:
            return Response(
                {'error': 'You cannot like your own activity'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Checks if already liked
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
        """Unlikes an activity."""
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
    """Gets list of users who liked an activity."""
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