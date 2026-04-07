from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse
from .models import VideoAnalysis, Vehicle, AccidentEvent
from .serializers import (
    VideoAnalysisSerializer,
    VideoAnalysisCreateSerializer,
    VideoAnalysisStatusSerializer,
    VehicleSerializer,
    AccidentEventSerializer
)
from .tasks import process_video_background
import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['POST'])
def test_upload(request):
    """
    Test endpoint to debug file upload issues
    """
    logger.info("=== TEST UPLOAD ENDPOINT ===")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Content-Type: {request.content_type}")
    logger.info(f"FILES keys: {list(request.FILES.keys())}")
    logger.info(f"POST keys: {list(request.POST.keys())}")
    logger.info(f"data keys: {list(request.data.keys())}")
    
    if 'video_file' in request.FILES:
        video = request.FILES['video_file']
        logger.info(f"Video file found: {video.name}, size: {video.size} bytes")
    else:
        logger.warning("No video_file in request.FILES")
    
    return Response({
        'message': 'Test endpoint',
        'files': list(request.FILES.keys()),
        'data': list(request.data.keys()),
        'content_type': request.content_type
    }, status=status.HTTP_200_OK)

logger = logging.getLogger(__name__)


class VideoAnalysisViewSet(viewsets.ModelViewSet):
    """
    ViewSet for VideoAnalysis CRUD operations
    """
    queryset = VideoAnalysis.objects.all()
    serializer_class = VideoAnalysisSerializer
    
    def get_serializer_class(self):
        if self.action == 'create':
            return VideoAnalysisCreateSerializer
        elif self.action == 'status':
            return VideoAnalysisStatusSerializer
        return VideoAnalysisSerializer
    
    def create(self, request, *args, **kwargs):
        """Create new video analysis and start processing"""
        try:
            logger.info(f"Received upload request. Files: {request.FILES.keys()}, Data: {request.data.keys()}")
            
            serializer = self.get_serializer(data=request.data)
            
            if not serializer.is_valid():
                logger.error(f"Validation errors: {serializer.errors}")
                return Response(
                    {'error': 'Validation failed', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            analysis = serializer.save()
            logger.info(f"Analysis created with ID: {analysis.id}")
            
            if not analysis.is_live:
                if not analysis.video_file:
                    logger.error("Video file was not saved")
                    return Response(
                        {'error': 'Video file was not uploaded properly'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                logger.info(f"Video file saved at: {analysis.video_file.path}")
            
            analysis.status = 'pending'
            analysis.save()
            
            if not analysis.is_live:
                try:
                    process_video_background(str(analysis.id))
                    logger.info(f"Started processing for analysis {analysis.id}")
                except Exception as e:
                    logger.error(f"Error starting video processing: {str(e)}", exc_info=True)
                    analysis.status = 'failed'
                    analysis.error_message = str(e)
                    analysis.save()
            
            return Response(
                VideoAnalysisSerializer(analysis).data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"Unexpected error in create: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get analysis status"""
        analysis = self.get_object()
        serializer = VideoAnalysisStatusSerializer(analysis)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def vehicles(self, request, pk=None):
        """Get all vehicles for this analysis"""
        analysis = self.get_object()
        vehicles = analysis.vehicles.all()
        serializer = VehicleSerializer(vehicles, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def graph_data(self, request, pk=None):
        """Get graph data for visualization"""
        analysis = self.get_object()
        vehicles = analysis.vehicles.all()
        
        graph_data = {
            'vehicles': [
                {
                    'id': v.vehicle_id,
                    'avg_speed': v.avg_speed_kmh,
                    'max_speed': v.max_speed_kmh,
                    'max_probability': v.max_probability,
                    'is_accident': v.is_accident_vehicle,
                }
                for v in vehicles
            ],
            'timeline': {
                'total_frames': analysis.total_frames,
                'fps': analysis.fps,
                'duration': analysis.duration_seconds,
            }
        }
        
        return Response(graph_data)
    
    @action(detail=True, methods=['get'])
    def download_video(self, request, pk=None):
        """Download annotated output video"""
        analysis = self.get_object()
        
        if not analysis.output_video:
            return Response(
                {'error': 'Output video not available'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            return FileResponse(
                analysis.output_video.open('rb'),
                as_attachment=True,
                filename=f'output_{analysis.id}.mp4'
            )
        except Exception as e:
            logger.error(f"Error downloading video: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def download_clip(self, request, pk=None):
        """Download accident clip"""
        analysis = self.get_object()
        
        if not analysis.accident_clip:
            return Response(
                {'error': 'Accident clip not available'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            return FileResponse(
                analysis.accident_clip.open('rb'),
                as_attachment=True,
                filename=f'accident_clip_{analysis.id}.mp4'
            )
        except Exception as e:
            logger.error(f"Error downloading clip: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def download_csv(self, request, pk=None):
        """Download CSV file with vehicle data"""
        analysis = self.get_object()
        
        if not analysis.csv_file:
            return Response(
                {'error': 'CSV file not available'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            return FileResponse(
                analysis.csv_file.open('rb'),
                as_attachment=True,
                filename=f'vehicles_{analysis.id}.csv',
                content_type='text/csv'
            )
        except Exception as e:
            logger.error(f"Error downloading CSV: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['delete'])
    def delete_analysis(self, request, pk=None):
        """Delete analysis and all associated files"""
        analysis = self.get_object()
        
        try:
            if analysis.video_file:
                analysis.video_file.delete()
            if analysis.output_video:
                analysis.output_video.delete()
            if analysis.accident_clip:
                analysis.accident_clip.delete()
            if analysis.csv_file:
                analysis.csv_file.delete()
            
            analysis.delete()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting analysis: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VehicleViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Vehicle read operations
    """
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        analysis_id = self.request.query_params.get('analysis_id')
        
        if analysis_id:
            queryset = queryset.filter(analysis_id=analysis_id)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        """Get detailed vehicle information"""
        vehicle = self.get_object()
        serializer = VehicleSerializer(vehicle)
        return Response(serializer.data)


class AccidentEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for AccidentEvent read operations
    """
    queryset = AccidentEvent.objects.all()
    serializer_class = AccidentEventSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        analysis_id = self.request.query_params.get('analysis_id')
        
        if analysis_id:
            queryset = queryset.filter(analysis_id=analysis_id)
        
        return queryset