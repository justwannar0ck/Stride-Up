from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserProfileViewSet,
    FollowViewSet,
    FollowRequestViewSet,
    UserSearchView,
)

router = DefaultRouter()
router.register(r'users', UserProfileViewSet, basename='user')
router.register(r'follow-requests', FollowRequestViewSet, basename='follow-request')

urlpatterns = [
    path('', include(router.urls)),
    
    # Follow actions
    path('follow/<str:username>/', FollowViewSet.as_view({'post': 'follow'}), name='follow-user'),
    path('follow/<str:username>/unfollow/', FollowViewSet.as_view({'delete': 'unfollow'}), name='unfollow-user'),
    path('follow/<str:username>/remove/', FollowViewSet.as_view({'delete': 'remove_follower'}), name='remove-follower'),
    
    # User search
    path('search/users/', UserSearchView.as_view(), name='user-search'),
]