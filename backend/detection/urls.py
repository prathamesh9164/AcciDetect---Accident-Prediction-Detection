from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'analysis', views.VideoAnalysisViewSet, basename='analysis')
router.register(r'vehicles', views.VehicleViewSet, basename='vehicles')
router.register(r'accidents', views.AccidentEventViewSet, basename='accidents')

urlpatterns = [
    path('', include(router.urls)),
]