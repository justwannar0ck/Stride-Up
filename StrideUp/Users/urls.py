from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserProfileViewSet,
    FollowViewSet,
    FollowRequestViewSet,
    UserSearchView,
    PrivacyZoneViewSet,           # ADD THIS IMPORT
    UserPrivacySettingsView,       # ADD THIS IMPORT
)

router = DefaultRouter()
router.register(r'users', UserProfileViewSet, basename='user')
router.register(r'follow-requests', FollowRequestViewSet, basename='follow-request')

# Create a separate router for privacy zones (nested under users/me/)
privacy_router = DefaultRouter()
privacy_router.register(r'privacy-zones', PrivacyZoneViewSet, basename='privacy-zone')

urlpatterns = [
    path('', include(router.urls)),
    
    # Follow actions
    path('follow/<str:username>/', FollowViewSet.as_view({'post': 'follow'}), name='follow-user'),
    path('follow/<str:username>/unfollow/', FollowViewSet.as_view({'delete': 'unfollow'}), name='unfollow-user'),
    path('follow/<str:username>/remove/', FollowViewSet.as_view({'delete': 'remove_follower'}), name='remove-follower'),
    
    # User search
    path('search/users/', UserSearchView.as_view(), name='user-search'),
    
    # ============ PRIVACY ENDPOINTS (ADD THESE) ============
    # Privacy zones: /api/users/me/privacy-zones/
    path('users/me/', include(privacy_router.urls)),
    
    # Privacy settings: /api/users/me/privacy-settings/
    path('users/me/privacy-settings/', UserPrivacySettingsView.as_view(), name='privacy-settings'),
]