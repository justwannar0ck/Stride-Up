from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityViewSet, UserStatisticsView

router = DefaultRouter()
router.register(r'', ActivityViewSet, basename='activity')

urlpatterns = [
    path('statistics/', UserStatisticsView.as_view(), name='user-statistics'),
    path('', include(router.urls)),
]