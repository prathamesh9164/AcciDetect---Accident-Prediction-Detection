from rest_framework import serializers
from .models import VideoAnalysis, Vehicle, AccidentEvent


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            'id',
            'vehicle_id',
            'avg_speed_kmh',
            'max_speed_kmh',
            'last_speed_kmh',
            'max_probability',
            'latest_probability',
            'frames_tracked',
            'first_seen_frame',
            'last_seen_frame',
            'is_accident_vehicle',
            'accident_frame',
            'speed_history',
            'probability_history',
            'centroid_history',
        ]


class AccidentEventSerializer(serializers.ModelSerializer):
    vehicles = VehicleSerializer(many=True, read_only=True)
    
    class Meta:
        model = AccidentEvent
        fields = [
            'id',
            'frame_number',
            'timestamp_seconds',
            'vehicles',
            'max_probability',
            'collision_point_x',
            'collision_point_y',
            'pre_accident_frames',
            'post_accident_frames',
            'details',
            'created_at',
        ]


class VideoAnalysisSerializer(serializers.ModelSerializer):
    vehicles_count = serializers.SerializerMethodField()
    accident_events_count = serializers.SerializerMethodField()
    
    class Meta:
        model = VideoAnalysis
        fields = [
            'id',
            'video_file',
            'is_live',
            'status',
            'progress',
            'fps',
            'total_frames',
            'width',
            'height',
            'duration_seconds',
            'accident_detected',
            'accident_frame',
            'accident_timestamp',
            'output_video',
            'accident_clip',
            'csv_file',
            'error_message',
            'created_at',
            'updated_at',
            'completed_at',
            'vehicles_count',
            'accident_events_count',
        ]
        read_only_fields = [
            'id',
            'status',
            'progress',
            'accident_detected',
            'error_message',
            'created_at',
            'updated_at',
            'completed_at',
        ]
    
    def get_vehicles_count(self, obj):
        return obj.vehicles.count()
    
    def get_accident_events_count(self, obj):
        return obj.accident_events.count()


class VideoAnalysisCreateSerializer(serializers.ModelSerializer):
    video_file = serializers.FileField(required=False, allow_null=True)
    is_live = serializers.BooleanField(default=False)
    
    class Meta:
        model = VideoAnalysis
        fields = ['video_file', 'is_live']
    
    def validate(self, data):
        is_live = data.get('is_live', False)
        video_file = data.get('video_file')
        
        if not is_live and not video_file:
            raise serializers.ValidationError({
                'video_file': 'Video file is required when not using live stream'
            })
        
        return data


class VideoAnalysisStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoAnalysis
        fields = [
            'id',
            'status',
            'progress',
            'accident_detected',
            'accident_frame',
            'accident_timestamp',
            'total_frames',
            'error_message',
        ]