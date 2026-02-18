from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CommunityViewSet, ChallengeViewSet, ChallengeFeedView, GeocodeView

router = DefaultRouter()
router.register(r'communities', CommunityViewSet, basename='community')

challenge_router = DefaultRouter()
challenge_router.register(r'', ChallengeViewSet, basename='challenge')

urlpatterns = [
    path('challenges/feed/', ChallengeFeedView.as_view(), name='challenge-feed'),
    path('geocode/', GeocodeView.as_view(), name='geocode'),
    path(
        'communities/<int:community_id>/challenges/', 
        include(challenge_router.urls)
    ),
    path('', include(router.urls)),
]