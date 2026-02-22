from rest_framework import serializers
from django.contrib.gis.geos import LineString, Point
from django.utils import timezone
from .models import Activity, GPSPoint, ActivityPause, ActivityLike

class GPSPointSerializer(serializers.ModelSerializer):
    """Serializer for individual GPS points"""
    
    class Meta:
        model = GPSPoint
        fields = [
            'id', 'latitude', 'longitude', 'elevation',
            'timestamp', 'accuracy', 'speed', 'heading'
        ]
        read_only_fields = ['id']


class ActivityPauseSerializer(serializers.ModelSerializer):
    """Serializer for activity pauses"""
    duration_seconds = serializers.SerializerMethodField()
    
    class Meta:
        model = ActivityPause
        fields = ['id', 'paused_at', 'resumed_at', 'duration_seconds']
        read_only_fields = ['id']
    
    def get_duration_seconds(self, obj):
        if obj.duration:
            return obj.duration.total_seconds()
        return None


class ActivityCreateSerializer(serializers.ModelSerializer):
    """Serializer for starting a new activity"""
    
    class Meta:
        model = Activity
        fields = [
            'id', 'activity_type', 'visibility', 'hide_start_end',
            'privacy_zone_radius', 'started_at'
        ]
        read_only_fields = ['id', 'started_at']
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['status'] = Activity.Status.IN_PROGRESS
        validated_data['started_at'] = timezone.now()
        return super().create(validated_data)


class ActivityUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating activity during recording"""
    
    class Meta:
        model = Activity
        fields = [
            'title', 'description', 'visibility',
            'hide_start_end', 'privacy_zone_radius'
        ]


class GPSBatchUploadSerializer(serializers.Serializer):
    """Serializer for uploading batch of GPS points"""
    
    activity_id = serializers.IntegerField()
    points = GPSPointSerializer(many=True)
    
    def validate_activity_id(self, value):
        user = self.context['request'].user
        try:
            activity = Activity.objects.get(id=value, user=user)
            if activity.status == Activity.Status.COMPLETED:
                raise serializers.ValidationError("Cannot add points to completed activity")
            return value
        except Activity.DoesNotExist:
            raise serializers.ValidationError("Activity not found")
    
    def create(self, validated_data):
        activity = Activity.objects.get(id=validated_data['activity_id'])
        points_data = validated_data['points']
        
        gps_points = []
        for point_data in points_data:
            gps_points.append(GPSPoint(
                activity=activity,
                **point_data
            ))
        
        GPSPoint.objects.bulk_create(gps_points)
        
        return {'activity_id': activity.id, 'points_added': len(gps_points)}


class ActivityCompleteSerializer(serializers.Serializer):
    """Serializer for completing an activity"""
    
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    visibility = serializers.ChoiceField(
        choices=Activity.Visibility.choices,
        required=False
    )
    hide_start_end = serializers.BooleanField(required=False)

# Updated ActivityListSerializer
class ActivityListSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    distance_km = serializers.FloatField(read_only=True)
    duration_formatted = serializers.CharField(read_only=True)
    pace_formatted = serializers.CharField(read_only=True)
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id', 'user_username', 'title', 'description', 'activity_type',
            'status', 'distance', 'distance_km', 'duration', 'duration_formatted',
            'average_pace', 'pace_formatted', 'started_at', 'finished_at',
            'visibility', 'likes_count', 'is_liked'
        ]
    
    def get_likes_count(self, obj):
        return obj.likes.count()
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False


# Updated ActivityDetailSerializer
class ActivityDetailSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source='user.username', read_only=True)
    distance_km = serializers.FloatField(read_only=True)
    duration_formatted = serializers.CharField(read_only=True)
    pace_formatted = serializers.CharField(read_only=True)
    route_geojson = serializers.SerializerMethodField()
    start_location = serializers.SerializerMethodField()
    end_location = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Activity
        fields = [
            'id', 'user_username', 'title', 'description', 'activity_type',
            'status', 'distance', 'distance_km', 'duration', 'duration_formatted',
            'total_elapsed_time', 'average_pace', 'pace_formatted', 'average_speed',
            'max_speed', 'elevation_gain', 'elevation_loss', 'calories_burned',
            'started_at', 'finished_at', 'visibility', 'hide_start_end',
            'route_geojson', 'start_location', 'end_location',
            'likes_count', 'is_liked'
        ]
    
    def get_route_geojson(self, obj):
        return obj.get_route_for_display()
    
    def get_start_location(self, obj):
        if obj.hide_start_end and obj.masked_start_point:
            return {
                'latitude': obj.masked_start_point.y,
                'longitude': obj.masked_start_point.x
            }
        elif obj.start_point:
            return {
                'latitude': obj.start_point.y,
                'longitude': obj.start_point.x
            }
        return None
    
    def get_end_location(self, obj):
        if obj.hide_start_end and obj.masked_end_point:
            return {
                'latitude': obj.masked_end_point.y,
                'longitude': obj.masked_end_point.x
            }
        elif obj.end_point:
            return {
                'latitude': obj.end_point.y,
                'longitude': obj.end_point.x
            }
        return None
    
    def get_likes_count(self, obj):
        return obj.likes.count()
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False