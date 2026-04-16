from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'analyses', views.VideoAnalysisViewSet, basename='analysis')
router.register(r'vehicles', views.VehicleViewSet, basename='vehicles')
router.register(r'accidents', views.AccidentEventViewSet, basename='accidents')

urlpatterns = [
    path('', include(router.urls)),
    # Utility endpoints
    path('health/', views.health_check, name='health-check'),
    path('test-upload/', views.test_upload, name='test-upload'),
]