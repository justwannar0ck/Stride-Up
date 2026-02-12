from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CommunityViewSet, MyCommunityInvitesView

router = DefaultRouter()
router.register(r'communities', CommunityViewSet, basename='community')

urlpatterns = [
    path('', include(router.urls)),
    path('my-invites/', MyCommunityInvitesView.as_view(), name='my-community-invites'),
]