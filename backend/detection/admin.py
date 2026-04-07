from django.contrib import admin
from .models import VideoAnalysis, Vehicle, AccidentEvent


@admin.register(VideoAnalysis)
class VideoAnalysisAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'status',
        'progress',
        'accident_detected',
        'total_frames',
        'created_at',
        'is_live'
    ]
    list_filter = ['status', 'accident_detected', 'is_live', 'created_at']
    search_fields = ['id']
    readonly_fields = [
        'id',
        'created_at',
        'updated_at',
        'completed_at',
        'fps',
        'total_frames',
        'width',
        'height',
        'duration_seconds'
    ]
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'video_file', 'is_live', 'status', 'progress')
        }),
        ('Video Metadata', {
            'fields': ('fps', 'total_frames', 'width', 'height', 'duration_seconds')
        }),
        ('Analysis Results', {
            'fields': ('accident_detected', 'accident_frame', 'accident_timestamp')
        }),
        ('Output Files', {
            'fields': ('output_video', 'accident_clip', 'csv_file')
        }),
        ('Error Info', {
            'fields': ('error_message',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'completed_at')
        }),
    )


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = [
        'vehicle_id',
        'analysis',
        'avg_speed_kmh',
        'max_probability',
        'is_accident_vehicle',
        'frames_tracked'
    ]
    list_filter = ['is_accident_vehicle', 'analysis']
    search_fields = ['vehicle_id', 'analysis__id']
    readonly_fields = ['created_at']


@admin.register(AccidentEvent)
class AccidentEventAdmin(admin.ModelAdmin):
    list_display = [
        'analysis',
        'frame_number',
        'timestamp_seconds',
        'max_probability',
        'created_at'
    ]
    list_filter = ['analysis', 'created_at']
    readonly_fields = ['created_at']