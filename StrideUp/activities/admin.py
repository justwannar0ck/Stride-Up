from django.contrib import admin
from .models import Activity, GPSPoint, ActivityPause


class GPSPointInline(admin.TabularInline):
    model = GPSPoint
    extra = 0
    readonly_fields = ['latitude', 'longitude', 'elevation', 'timestamp', 'accuracy', 'speed']
    can_delete = False
    max_num = 0


class ActivityPauseInline(admin.TabularInline):
    model = ActivityPause
    extra = 0
    readonly_fields = ['paused_at', 'resumed_at']


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'activity_type', 'title', 'status',
        'distance_display', 'duration_formatted', 'started_at', 'visibility'
    ]
    list_filter = ['activity_type', 'status', 'visibility', 'created_at']
    search_fields = ['user__username', 'title', 'description']
    readonly_fields = [
        'distance', 'duration', 'total_elapsed_time', 'average_pace',
        'average_speed', 'max_speed', 'elevation_gain', 'elevation_loss',
        'calories_burned', 'created_at', 'updated_at'
    ]
    inlines = [ActivityPauseInline]
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('user', 'title', 'description', 'activity_type', 'status')
        }),
        ('Timing', {
            'fields': ('started_at', 'finished_at', 'duration', 'total_elapsed_time')
        }),
        ('Statistics', {
            'fields': (
                'distance', 'average_pace', 'average_speed', 'max_speed',
                'elevation_gain', 'elevation_loss', 'calories_burned'
            )
        }),
        ('Privacy', {
            'fields': ('visibility', 'hide_start_end', 'privacy_zone_radius')
        }),
        ('Weather', {
            'fields': ('weather_temp', 'weather_condition'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def distance_display(self, obj):
        return f"{obj.distance_km} km"
    distance_display.short_description = "Distance"


@admin.register(GPSPoint)
class GPSPointAdmin(admin.ModelAdmin):
    list_display = ['activity', 'latitude', 'longitude', 'elevation', 'timestamp', 'accuracy']
    list_filter = ['activity__user', 'activity']
    search_fields = ['activity__title', 'activity__user__username']