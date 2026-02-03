from django.contrib.gis.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Activity(models.Model):
    """
    Model to store user activities (runs, walks, cycles, hikes)
    with GPS route data using PostGIS LineString geometry.
    """
    
    class ActivityType(models.TextChoices):
        RUN = 'run', 'Run'
        WALK = 'walk', 'Walk'
        CYCLE = 'cycle', 'Cycle'
        HIKE = 'hike', 'Hike'
    
    class Visibility(models.TextChoices):
        PUBLIC = 'public', 'Public'
        FOLLOWERS = 'followers', 'Followers Only'
        PRIVATE = 'private', 'Private'
    
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'
        DISCARDED = 'discarded', 'Discarded'
    
    # User who recorded the activity
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='activities'
    )
    
    # Activity details
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    activity_type = models.CharField(
        max_length=20,
        choices=ActivityType.choices,
        default=ActivityType.RUN
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS
    )
    
    # GPS Route - LineString geometry for storing the path
    route = models.LineStringField(
        geography=True,
        srid=4326,
        null=True,
        blank=True
    )
    
    # Start and end points
    start_point = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True
    )
    end_point = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True
    )
    
    # Privacy: Masked points (with privacy zone applied)
    masked_start_point = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True,
        help_text="Start point with privacy zone offset applied"
    )
    masked_end_point = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True,
        help_text="End point with privacy zone offset applied"
    )
    
    # Privacy zone radius in meters
    privacy_zone_radius = models.IntegerField(
        default=200,
        help_text="Radius in meters to mask start/end points"
    )
    
    # Calculated statistics
    distance = models.FloatField(
        help_text="Total distance in meters",
        default=0
    )
    duration = models.DurationField(
        help_text="Total activity duration (excluding pauses)",
        null=True,
        blank=True
    )
    total_elapsed_time = models.DurationField(
        help_text="Total elapsed time including pauses",
        null=True,
        blank=True
    )
    average_pace = models.FloatField(
        help_text="Average pace in seconds per kilometer",
        null=True,
        blank=True
    )
    average_speed = models.FloatField(
        help_text="Average speed in km/h",
        null=True,
        blank=True
    )
    max_speed = models.FloatField(
        help_text="Maximum speed in km/h",
        null=True,
        blank=True
    )
    elevation_gain = models.FloatField(
        help_text="Total elevation gain in meters",
        null=True,
        blank=True
    )
    elevation_loss = models.FloatField(
        help_text="Total elevation loss in meters",
        null=True,
        blank=True
    )
    calories_burned = models.FloatField(
        help_text="Estimated calories burned",
        null=True,
        blank=True
    )
    
    # Timestamps
    started_at = models.DateTimeField(
        help_text="When the activity started",
        default=timezone.now
    )
    finished_at = models.DateTimeField(
        help_text="When the activity finished",
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Privacy settings
    visibility = models.CharField(
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PUBLIC
    )
    hide_start_end = models.BooleanField(
        default=False,
        help_text="Whether to hide/mask start and end points"
    )
    
    # Weather data (optional)
    weather_temp = models.FloatField(null=True, blank=True, help_text="Temperature in Celsius")
    weather_condition = models.CharField(max_length=50, blank=True)
    
    class Meta:
        ordering = ['-started_at']
        verbose_name_plural = 'Activities'
        indexes = [
            models.Index(fields=['user', '-started_at']),
            models.Index(fields=['status']),
            models.Index(fields=['activity_type']),
        ]
    
    def __str__(self):
        return f"{self.user.username}'s {self.activity_type} - {self.started_at.strftime('%Y-%m-%d %H:%M')}"
    
    def save(self, *args, **kwargs):
        # Auto-generate title if not provided
        if not self.title and self.started_at:
            time_of_day = self._get_time_of_day()
            self.title = f"{time_of_day} {self.get_activity_type_display()}"
        
        super().save(*args, **kwargs)
    
    def _get_time_of_day(self):
        """Return time of day string based on started_at"""
        if not self.started_at:
            return "Morning"
        
        hour = self.started_at.hour
        if 5 <= hour < 12:
            return "Morning"
        elif 12 <= hour < 17:
            return "Afternoon"
        elif 17 <= hour < 21:
            return "Evening"
        else:
            return "Night"
    
    def calculate_statistics(self):
        """Calculate all statistics from GPS points - called after activity completion"""
        from django.contrib.gis.geos import LineString, Point
        
        gps_points = self.gps_points.order_by('timestamp')
        
        if gps_points.count() < 2:
            return
        
        # Build route from GPS points
        coords = [(p.longitude, p.latitude) for p in gps_points]
        self.route = LineString(coords, srid=4326)
        
        # Set start and end points
        first_point = gps_points.first()
        last_point = gps_points.last()
        
        self.start_point = Point(first_point.longitude, first_point.latitude, srid=4326)
        self.end_point = Point(last_point.longitude, last_point.latitude, srid=4326)
        
        # Apply privacy masking if enabled
        if self.hide_start_end:
            self._apply_privacy_masking()
        
        # Calculate distance (PostGIS geography gives us meters)
        self.distance = self.route.length
        
        # Calculate duration
        if first_point.timestamp and last_point.timestamp:
            self.total_elapsed_time = last_point.timestamp - first_point.timestamp
            
            # Calculate active duration (excluding pauses)
            pause_duration = self._calculate_pause_duration()
            self.duration = self.total_elapsed_time - pause_duration
        
        # Calculate pace and speed
        if self.distance and self.duration:
            self._calculate_pace_and_speed()
        
        # Calculate elevation
        self._calculate_elevation()
        
        # Calculate calories
        self._calculate_calories()
        
        self.save()
    
    def _apply_privacy_masking(self):
        """Offset start/end points by privacy zone radius"""
        import random
        import math
        from django.contrib.gis.geos import Point
        
        def offset_point(point, radius_meters):
            if not point:
                return None
            
            angle = random.uniform(0, 2 * math.pi)
            distance = random.uniform(radius_meters * 0.5, radius_meters)
            
            lat_offset = (distance * math.cos(angle)) / 111000
            lon_offset = (distance * math.sin(angle)) / (111000 * math.cos(math.radians(point.y)))
            
            return Point(point.x + lon_offset, point.y + lat_offset, srid=4326)
        
        self.masked_start_point = offset_point(self.start_point, self.privacy_zone_radius)
        self.masked_end_point = offset_point(self.end_point, self.privacy_zone_radius)
    
    def _calculate_pause_duration(self):
        """Calculate total pause duration from activity pauses"""
        total_pause = timedelta()
        for pause in self.pauses.filter(resumed_at__isnull=False):
            total_pause += pause.resumed_at - pause.paused_at
        return total_pause
    
    def _calculate_pace_and_speed(self):
        """Calculate average pace and speed"""
        if self.distance and self.duration:
            total_seconds = self.duration.total_seconds()
            distance_km = self.distance / 1000
            
            if distance_km > 0 and total_seconds > 0:
                self.average_pace = total_seconds / distance_km
                self.average_speed = distance_km / (total_seconds / 3600)
    
    def _calculate_elevation(self):
        """Calculate elevation gain and loss from GPS points"""
        gps_points = self.gps_points.filter(elevation__isnull=False).order_by('timestamp')
        
        if gps_points.count() < 2:
            return
        
        elevations = list(gps_points.values_list('elevation', flat=True))
        
        gain = 0
        loss = 0
        
        for i in range(1, len(elevations)):
            diff = elevations[i] - elevations[i-1]
            if diff > 0:
                gain += diff
            else:
                loss += abs(diff)
        
        self.elevation_gain = gain
        self.elevation_loss = loss
    
    def _calculate_calories(self):
        """Estimate calories burned based on activity type, distance, and duration"""
        if not self.distance or not self.duration:
            return
        
        met_values = {
            'run': 9.8,
            'walk': 3.8,
            'cycle': 7.5,
            'hike': 6.0,
        }
        
        met = met_values.get(self.activity_type, 5.0)
        weight_kg = 70  # Default weight
        hours = self.duration.total_seconds() / 3600
        
        self.calories_burned = met * weight_kg * hours
    
    def get_route_for_display(self):
        """Get route data formatted for frontend display"""
        if not self.route:
            return None
        
        coords = self.route.coords
        
        # If privacy is enabled, trim start/end of route
        if self.hide_start_end and len(coords) > 10:
            trim_count = max(2, len(coords) // 20)
            coords = coords[trim_count:-trim_count]
        
        return {
            'type': 'LineString',
            'coordinates': [[c[0], c[1]] for c in coords]
        }
    
    @property
    def distance_km(self):
        """Return distance in kilometers"""
        return round(self.distance / 1000, 2) if self.distance else 0
    
    @property
    def pace_formatted(self):
        """Return pace as MM:SS per km"""
        if not self.average_pace:
            return "--:--"
        
        minutes = int(self.average_pace // 60)
        seconds = int(self.average_pace % 60)
        return f"{minutes}:{seconds:02d}"
    
    @property
    def duration_formatted(self):
        """Return duration as HH:MM:SS"""
        if not self.duration:
            return "00:00:00"
        
        total_seconds = int(self.duration.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


class GPSPoint(models.Model):
    """
    Individual GPS points for detailed tracking.
    """
    
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='gps_points'
    )
    
    latitude = models.FloatField()
    longitude = models.FloatField()
    
    location = models.PointField(
        geography=True,
        srid=4326,
        null=True,
        blank=True
    )
    
    elevation = models.FloatField(
        null=True,
        blank=True,
        help_text="Elevation/altitude in meters"
    )
    timestamp = models.DateTimeField()
    accuracy = models.FloatField(
        null=True,
        blank=True,
        help_text="GPS accuracy in meters"
    )
    speed = models.FloatField(
        null=True,
        blank=True,
        help_text="Speed at this point in m/s"
    )
    heading = models.FloatField(
        null=True,
        blank=True,
        help_text="Heading/bearing in degrees"
    )
    
    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['activity', 'timestamp']),
        ]
    
    def __str__(self):
        return f"GPS Point at {self.timestamp}"
    
    def save(self, *args, **kwargs):
        from django.contrib.gis.geos import Point
        if self.latitude and self.longitude:
            self.location = Point(self.longitude, self.latitude, srid=4326)
        super().save(*args, **kwargs)


class ActivityPause(models.Model):
    """
    Records pause events during an activity.
    """
    
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name='pauses'
    )
    paused_at = models.DateTimeField()
    resumed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['paused_at']
    
    def __str__(self):
        return f"Pause at {self.paused_at}"
    
    @property
    def duration(self):
        """Return pause duration"""
        if self.resumed_at:
            return self.resumed_at - self.paused_at
        return None