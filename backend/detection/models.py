from django.db import models
from django.utils import timezone
import uuid


class VideoAnalysis(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    video_file = models.FileField(upload_to='videos/', null=True, blank=True)
    is_live = models.BooleanField(default=False)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0)
    
    fps = models.FloatField(null=True, blank=True)
    total_frames = models.IntegerField(null=True, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    
    accident_detected = models.BooleanField(default=False)
    accident_frame = models.IntegerField(null=True, blank=True)
    accident_timestamp = models.FloatField(null=True, blank=True)
    
    output_video = models.FileField(upload_to='output/', null=True, blank=True)
    accident_clip = models.FileField(upload_to='clips/', null=True, blank=True)
    csv_file = models.FileField(upload_to='csv/', null=True, blank=True)
    
    error_message = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]
        verbose_name = 'Video Analysis'
        verbose_name_plural = 'Video Analyses'
    
    def __str__(self):
        return f"Analysis {self.id} - {self.status}"


class Vehicle(models.Model):
    analysis = models.ForeignKey(VideoAnalysis, on_delete=models.CASCADE, related_name='vehicles')
    vehicle_id = models.IntegerField()
    
    # Speed data
    avg_speed_kmh = models.FloatField(default=0.0)
    max_speed_kmh = models.FloatField(default=0.0)
    last_speed_kmh = models.FloatField(default=0.0)
    
    # Probability data
    max_probability = models.FloatField(default=0.0)
    latest_probability = models.FloatField(default=0.0)
    
    # Tracking data
    frames_tracked = models.IntegerField(default=0)
    first_seen_frame = models.IntegerField(null=True, blank=True)
    last_seen_frame = models.IntegerField(null=True, blank=True)
    
    # Bounding box (last position)
    last_bbox_x1 = models.IntegerField(null=True, blank=True)
    last_bbox_y1 = models.IntegerField(null=True, blank=True)
    last_bbox_x2 = models.IntegerField(null=True, blank=True)
    last_bbox_y2 = models.IntegerField(null=True, blank=True)
    
    # Accident flag
    is_accident_vehicle = models.BooleanField(default=False)
    accident_frame = models.IntegerField(null=True, blank=True)
    
    # Time series data stored as JSON
    speed_history = models.JSONField(default=list, blank=True)
    probability_history = models.JSONField(default=list, blank=True)
    centroid_history = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['vehicle_id']
        unique_together = ['analysis', 'vehicle_id']
        indexes = [
            models.Index(fields=['analysis', 'vehicle_id']),
            models.Index(fields=['is_accident_vehicle']),
        ]
        verbose_name = 'Vehicle'
        verbose_name_plural = 'Vehicles'
    
    def __str__(self):
        return f"Vehicle {self.vehicle_id} (Analysis {self.analysis.id})"


class AccidentEvent(models.Model):
    analysis = models.ForeignKey(VideoAnalysis, on_delete=models.CASCADE, related_name='accident_events')
    
    frame_number = models.IntegerField()
    timestamp_seconds = models.FloatField()
    
    vehicles = models.ManyToManyField(Vehicle, related_name='accident_events')
    
    max_probability = models.FloatField()
    collision_point_x = models.IntegerField(null=True, blank=True)
    collision_point_y = models.IntegerField(null=True, blank=True)
    
    pre_accident_frames = models.IntegerField(default=0)
    post_accident_frames = models.IntegerField(default=0)
    
    details = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['frame_number']
        indexes = [
            models.Index(fields=['analysis', 'frame_number']),
        ]
        verbose_name = 'Accident Event'
        verbose_name_plural = 'Accident Events'
    
    def __str__(self):
        return f"Accident at frame {self.frame_number} (Analysis {self.analysis.id})"