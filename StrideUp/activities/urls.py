from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ActivityViewSet, MLPredictionView, UserStatisticsView, FeedView, ActivityLikeView, ActivityLikesListView

router = DefaultRouter()
router.register(r'', ActivityViewSet, basename='activity')

urlpatterns = [
    path('predict/', MLPredictionView.as_view(), name='ml-prediction'),
    path('statistics/', UserStatisticsView.as_view(), name='user-statistics'),
    path('feed/', FeedView.as_view(), name='activity-feed'),
    # Like URLs using dedicated views
    path('<int:pk>/like/', ActivityLikeView.as_view(), name='activity-like'),
    path('<int:pk>/likes/', ActivityLikesListView.as_view(), name='activity-likes'),
    path('', include(router.urls)),
]