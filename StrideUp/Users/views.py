from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q
from .models import PrivacyZone, UserPrivacySettings
from .serializers import PrivacyZoneSerializer, UserPrivacySettingsSerializer, UserProfileUpdateSerializer

from .models import User, Follow, FollowRequest
from .serializers import (
    UserMinimalSerializer,
    UserProfileSerializer,
    FollowerListSerializer,
    FollowingListSerializer,
    FollowRequestSerializer,
    PendingFollowRequestSerializer,
)


class UserProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing user profiles.
    """
    queryset = User.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Gets the current user's profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def followers(self, request, username=None):
        """Gets the list of followers for a user."""
        user = self.get_object()
        
        # Checks privacy - only show followers if public, following, or own profile
        if user.is_private and user != request.user:
            if not request.user.is_following(user):
                return Response(
                    {'error': 'This account is private'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        followers = Follow.objects.filter(following=user).select_related('follower')
        serializer = FollowerListSerializer(
            followers, 
            many=True,
            context={'request': request, 'profile_user': user}
        )
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def following(self, request, username=None):
        """Gets the list of users this user is following."""
        user = self.get_object()
        
        # Checks privacy
        if user.is_private and user != request.user:
            if not request.user.is_following(user):
                return Response(
                    {'error': 'This account is private'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        following = Follow.objects.filter(follower=user).select_related('following')
        serializer = FollowingListSerializer(
            following,
            many=True,
            context={'request': request}
        )
        return Response(serializer.data)
    
    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """Gets or updates the current user's profile."""
        if request.method == 'PATCH':
            serializer = UserProfileUpdateSerializer(
                request.user, 
                data=request.data, 
                partial=True
            )
            if serializer.is_valid():
                serializer.save()
                # Returns full profile after update
                return Response(UserProfileSerializer(request.user, context={'request': request}).data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class FollowViewSet(viewsets.ViewSet):
    """
    ViewSet for follow/unfollow actions.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='(?P<username>[^/.]+)')
    def follow(self, request, username=None):
        """
        Follows a user or sends a follow request if the account is private.
        """
        target_user = get_object_or_404(User, username=username)
        
        # Can't follow yourself
        if target_user == request.user:
            return Response(
                {'error': 'You cannot follow yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Checks if already following
        if request.user.is_following(target_user):
            return Response(
                {'error': 'You are already following this user'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Checks for pending request
        if request.user.has_pending_follow_request_to(target_user):
            return Response(
                {'error': 'You already have a pending follow request'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If target account is private, creates a follow request
        if target_user.is_private:
            follow_request, created = FollowRequest.objects.get_or_create(
                from_user=request.user,
                to_user=target_user,
                defaults={'status': FollowRequest.Status.PENDING}
            )
            
            if not created and follow_request.status == FollowRequest.Status.REJECTED:
                # Allows re-requesting after rejection
                follow_request.status = FollowRequest.Status.PENDING
                follow_request.save()
            
            return Response({
                'status': 'requested',
                'message': 'Follow request sent'
            }, status=status.HTTP_201_CREATED)
        
        # Public account - follows directly
        Follow.objects.create(follower=request.user, following=target_user)
        
        return Response({
            'status': 'following',
            'message': f'You are now following {target_user.username}'
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['delete'], url_path='(?P<username>[^/.]+)/unfollow')
    def unfollow(self, request, username=None):
        """Unfollowing a user."""
        target_user = get_object_or_404(User, username=username)
        
        # Deletes follow relationship
        deleted, _ = Follow.objects.filter(
            follower=request.user,
            following=target_user
        ).delete()
        
        if deleted:
            return Response({
                'status': 'not_following',
                'message': f'You have unfollowed {target_user.username}'
            })
        
        # Cancelling pending request
        deleted, _ = FollowRequest.objects.filter(
            from_user=request.user,
            to_user=target_user,
            status=FollowRequest.Status.PENDING
        ).delete()
        
        if deleted:
            return Response({
                'status': 'not_following',
                'message': 'Follow request cancelled'
            })
        
        return Response(
            {'error': 'You are not following this user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=False, methods=['delete'], url_path='(?P<username>[^/.]+)/remove')
    def remove_follower(self, request, username=None):
        """Removes a user from the followers."""
        follower_user = get_object_or_404(User, username=username)
        
        deleted, _ = Follow.objects.filter(
            follower=follower_user,
            following=request.user
        ).delete()
        
        if deleted:
            return Response({
                'message': f'{follower_user.username} has been removed from your followers'
            })
        
        return Response(
            {'error': 'This user is not following you'},
            status=status.HTTP_400_BAD_REQUEST
        )


class FollowRequestViewSet(viewsets.ViewSet):
    """
    ViewSet for managing follow requests.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        """Lists all pending follow requests received by the current user."""
        pending_requests = FollowRequest.objects.filter(
            to_user=request.user,
            status=FollowRequest.Status.PENDING
        ).select_related('from_user')
        
        serializer = PendingFollowRequestSerializer(pending_requests, many=True)
        return Response({
            'count': pending_requests.count(),
            'results': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accepts a follow request."""
        follow_request = get_object_or_404(
            FollowRequest,
            pk=pk,
            to_user=request.user,
            status=FollowRequest.Status.PENDING
        )
        
        if follow_request.accept():
            return Response({
                'message': f'{follow_request.from_user.username} is now following you'
            })
        
        return Response(
            {'error': 'Could not accept follow request'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Rejects a follow request."""
        follow_request = get_object_or_404(
            FollowRequest,
            pk=pk,
            to_user=request.user,
            status=FollowRequest.Status.PENDING
        )
        
        if follow_request.reject():
            return Response({
                'message': 'Follow request rejected'
            })
        
        return Response(
            {'error': 'Could not reject follow request'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=False, methods=['post'])
    def accept_all(self, request):
        """Accepts all pending follow requests."""
        pending_requests = FollowRequest.objects.filter(
            to_user=request.user,
            status=FollowRequest.Status.PENDING
        )
        
        count = 0
        for fr in pending_requests:
            if fr.accept():
                count += 1
        
        return Response({
            'message': f'Accepted {count} follow requests'
        })


class UserSearchView(generics.ListAPIView):
    """
    Searching for users by username or name.
    """
    serializer_class = UserMinimalSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        query = self.request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return User.objects.none()
        
        return User.objects.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        ).exclude(id=self.request.user.id)[:20]
        
class PrivacyZoneViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user's privacy zones.
    """
    serializer_class = PrivacyZoneSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return PrivacyZone.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        # Checks zone limit
        existing_count = self.get_queryset().count()
        if existing_count >= 10:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Maximum 10 privacy zones allowed'})
        serializer.save(user=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {'message': f'Privacy zone "{instance.name}" deleted'},
            status=status.HTTP_200_OK
        )
        
class UserPrivacySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        settings, created = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserPrivacySettingsSerializer(settings)
        return Response(serializer.data)
    
    def patch(self, request):
        settings, created = UserPrivacySettings.objects.get_or_create(
            user=request.user
        )
        serializer = UserPrivacySettingsSerializer(
            settings, 
            data=request.data, 
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)