from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from django.db.models import Q, Count
import uuid
from rest_framework.views import APIView
from .models import ChallengeRouteWaypoint

from .models import Community, CommunityMembership, CommunityInvite
from .serializers import (
    CommunityListSerializer,
    CommunityCreateSerializer,
    CommunityDetailSerializer,
    MembershipSerializer,
    CommunityInviteSerializer,
)


class CommunityViewSet(viewsets.ModelViewSet):
    """CRUD + membership actions for communities."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return CommunityCreateSerializer
        if self.action in ['retrieve']:
            return CommunityDetailSerializer
        return CommunityListSerializer
    
    def get_queryset(self):
        qs = Community.objects.annotate(
            active_members_count=Count(
                'memberships',
                filter=Q(memberships__status=CommunityMembership.Status.ACTIVE)
            )
        )
        
        # Filter: my communities
        mine = self.request.query_params.get('mine')
        if mine:
            qs = qs.filter(
                memberships__user=self.request.user,
                memberships__status=CommunityMembership.Status.ACTIVE,
            )
        
        # Search
        search = self.request.query_params.get('q', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        
        return qs.distinct()
    
    def perform_create(self, serializer):
        # Auto-generate slug
        name = serializer.validated_data['name']
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while Community.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        
        community = serializer.save(created_by=self.request.user, slug=slug)
        
        # Creator becomes the owner
        CommunityMembership.objects.create(
            community=community,
            user=self.request.user,
            role=CommunityMembership.Role.OWNER,
            status=CommunityMembership.Status.ACTIVE,
        )
        
    def update(self, request, *args, **kwargs):
        """Only owner/admin can update community settings."""
        community = self.get_object()
        
        membership = CommunityMembership.objects.filter(
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()
        
        if not membership or not membership.can_manage_members:
            return Response(
                {'detail': 'Only admins can edit community settings.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        """Only owner/admin can update community settings."""
        community = self.get_object()
        
        membership = CommunityMembership.objects.filter(
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()
        
        if not membership or not membership.can_manage_members:
            return Response(
                {'detail': 'Only admins can edit community settings.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().partial_update(request, *args, **kwargs)
    
    def destroy(self, request, pk=None):
        """Only the owner can delete a community."""
        community = self.get_object()
        
        membership = CommunityMembership.objects.filter(
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()
        
        if not membership or membership.role != CommunityMembership.Role.OWNER:
            return Response(
                {'detail': 'Only the owner can delete this community.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        community_name = community.name
        community.delete()
        
        return Response(
            {'detail': f'Community "{community_name}" has been deleted.'},
            status=status.HTTP_200_OK
        )
    
    # ── Join ──────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        community = self.get_object()
        
        existing = CommunityMembership.objects.filter(
            community=community, user=request.user
        ).first()
        
        if existing:
            if existing.status == CommunityMembership.Status.ACTIVE:
                return Response({'detail': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
            if existing.status == CommunityMembership.Status.BANNED:
                return Response({'detail': 'You are banned from this community.'}, status=status.HTTP_403_FORBIDDEN)
            if existing.status == CommunityMembership.Status.PENDING:
                return Response({'detail': 'Join request already pending.'}, status=status.HTTP_400_BAD_REQUEST)
            # If LEFT, allow re-joining
            existing.status = (
                CommunityMembership.Status.ACTIVE
                if community.visibility == Community.Visibility.PUBLIC
                else CommunityMembership.Status.PENDING
            )
            existing.role = CommunityMembership.Role.MEMBER
            existing.save()
            return Response({'detail': 'Joined!' if existing.status == 'active' else 'Request sent.'})
        
        # Check max members
        if community.members_count >= community.max_members:
            return Response({'detail': 'Community is full.'}, status=status.HTTP_400_BAD_REQUEST)
        
        membership_status = (
            CommunityMembership.Status.ACTIVE
            if community.visibility == Community.Visibility.PUBLIC
            else CommunityMembership.Status.PENDING
        )
        
        CommunityMembership.objects.create(
            community=community,
            user=request.user,
            role=CommunityMembership.Role.MEMBER,
            status=membership_status,
        )
        
        msg = 'Joined successfully!' if membership_status == 'active' else 'Join request sent.'
        return Response({'detail': msg}, status=status.HTTP_201_CREATED)
    
    # ── Leave ─────────────────────────────────────────────────
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        community = self.get_object()
        membership = get_object_or_404(
            CommunityMembership,
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        )
        
        if membership.role == CommunityMembership.Role.OWNER:
            # Must transfer ownership first
            return Response(
                {'detail': 'Owner cannot leave. Transfer ownership first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        membership.status = CommunityMembership.Status.LEFT
        membership.save()
        return Response({'detail': 'Left the community.'})
    
    # ── Members list ──────────────────────────────────────────
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        community = self.get_object()
        memberships = community.memberships.filter(
            status=CommunityMembership.Status.ACTIVE
        ).select_related('user')
        serializer = MembershipSerializer(memberships, many=True)
        return Response(serializer.data)
    
    # ── Pending requests (admin only) ─────────────────────────
    @action(detail=True, methods=['get'])
    def pending(self, request, pk=None):
        community = self.get_object()
        
        # Check admin
        membership = get_object_or_404(
            CommunityMembership,
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        )
        if not membership.can_manage_members:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        pending = community.memberships.filter(
            status=CommunityMembership.Status.PENDING
        ).select_related('user')
        serializer = MembershipSerializer(pending, many=True)
        return Response(serializer.data)
    
    # ── Approve / Reject ──────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='approve/(?P<membership_id>[0-9]+)')
    def approve(self, request, pk=None, membership_id=None):
        community = self.get_object()
        admin_membership = get_object_or_404(
            CommunityMembership,
            community=community, user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        )
        if not admin_membership.can_manage_members:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        target = get_object_or_404(
            CommunityMembership, id=membership_id,
            community=community, status=CommunityMembership.Status.PENDING,
        )
        target.status = CommunityMembership.Status.ACTIVE
        target.save()
        return Response({'detail': f'{target.user.username} approved.'})
    
    @action(detail=True, methods=['post'], url_path='reject/(?P<membership_id>[0-9]+)')
    def reject(self, request, pk=None, membership_id=None):
        community = self.get_object()
        admin_membership = get_object_or_404(
            CommunityMembership,
            community=community, user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        )
        if not admin_membership.can_manage_members:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        target = get_object_or_404(
            CommunityMembership, id=membership_id,
            community=community, status=CommunityMembership.Status.PENDING,
        )
        target.delete()
        return Response({'detail': 'Request rejected.'})
    
    # ── Update member role ────────────────────────────────────
    @action(detail=True, methods=['patch'], url_path='role/(?P<membership_id>[0-9]+)')
    def update_role(self, request, pk=None, membership_id=None):
        community = self.get_object()
        admin_membership = get_object_or_404(
            CommunityMembership,
            community=community, user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        )
        if not admin_membership.can_manage_members:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        new_role = request.data.get('role')
        if new_role not in dict(CommunityMembership.Role.choices):
            return Response({'detail': 'Invalid role.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only owner can promote to admin/owner
        if new_role in ['owner', 'admin'] and admin_membership.role != CommunityMembership.Role.OWNER:
            return Response({'detail': 'Only the owner can assign admin roles.'}, status=status.HTTP_403_FORBIDDEN)
        
        target = get_object_or_404(
            CommunityMembership, id=membership_id,
            community=community, status=CommunityMembership.Status.ACTIVE,
        )
        target.role = new_role
        target.save()
        return Response({'detail': f'Role updated to {new_role}.'})


class MyCommunityInvitesView(generics.ListAPIView):
    """List invites received by the current user."""
    serializer_class = CommunityInviteSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return CommunityInvite.objects.filter(
            invited_user=self.request.user,
            status=CommunityInvite.Status.PENDING,
        ).select_related('community', 'invited_by', 'invited_user')
        
# ─── Challenge Views ──────────────────────────────────────────────────────────

from .models import Challenge, ChallengeParticipant, ChallengeContribution
from .serializers import (
    ChallengeCreateSerializer,
    ChallengeListSerializer,
    ChallengeDetailSerializer,
)


class ChallengeViewSet(viewsets.ModelViewSet):
    """
    CRUD for challenges within a community.
    Nested under /api/v1/communities/<community_id>/challenges/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_community(self):
        community_id = self.kwargs.get('community_id')
        return Community.objects.get(pk=community_id)

    def get_queryset(self):
        community = self.get_community()
        # Sync status on access
        for c in community.challenges.exclude(status=Challenge.Status.CANCELLED):
            c.sync_status()
        return community.challenges.all()

    def get_serializer_class(self):
        if self.action == 'create':
            return ChallengeCreateSerializer
        if self.action == 'retrieve':
            return ChallengeDetailSerializer
        return ChallengeListSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, community_id=None):
        """Only owner/admin/moderator can create challenges."""
        community = self.get_community()

        membership = CommunityMembership.objects.filter(
            community=community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()

        if not membership or membership.role not in [
            CommunityMembership.Role.OWNER,
            CommunityMembership.Role.ADMIN,
            CommunityMembership.Role.MODERATOR,
        ]:
            return Response(
                {'detail': 'Only leaders can create challenges.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print("=== SERIALIZER ERRORS ===")
            print(serializer.errors)
            print("=========================")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from django.utils import timezone
        start = serializer.validated_data['start_date']
        end = serializer.validated_data['end_date']
        now = timezone.now()

        if now >= end:
            return Response(
                {'detail': 'End date must be in the future.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        initial_status = Challenge.Status.ACTIVE if now >= start else Challenge.Status.UPCOMING

        # Check if this is a route challenge
        is_route = request.data.get('is_route_challenge', False)
        waypoints_data = request.data.get('route_waypoints', [])

        if is_route and len(waypoints_data) < 2:
            return Response(
                {'detail': 'Route challenges need at least a start and end point.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        challenge = serializer.save(
            community=community,
            created_by=request.user,
            status=initial_status,
            is_route_challenge=is_route,
        )

        # Create waypoints if route challenge
        if is_route and waypoints_data:
            from .serializers import RouteWaypointCreateSerializer
            for wp_data in waypoints_data:
                wp_serializer = RouteWaypointCreateSerializer(data=wp_data)
                wp_serializer.is_valid(raise_exception=True)
                ChallengeRouteWaypoint.objects.create(
                    challenge=challenge,
                    **wp_serializer.validated_data,
                )

        return Response(
            ChallengeDetailSerializer(challenge, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, community_id=None, pk=None):
        """Only description can be edited."""
        challenge = self.get_object()

        membership = CommunityMembership.objects.filter(
            community=challenge.community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()

        if not membership or membership.role not in [
            CommunityMembership.Role.OWNER,
            CommunityMembership.Role.ADMIN,
        ]:
            return Response(
                {'detail': 'Only admins can edit challenges.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only allow description updates
        allowed_fields = {'description'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        if not data:
            return Response(
                {'detail': 'Only description can be edited.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for key, value in data.items():
            setattr(challenge, key, value)
        challenge.save()

        return Response(
            ChallengeDetailSerializer(challenge, context={'request': request}).data
        )

    def destroy(self, request, community_id=None, pk=None):
        """Cancel a challenge (owner/admin only)."""
        challenge = self.get_object()

        membership = CommunityMembership.objects.filter(
            community=challenge.community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()

        if not membership or membership.role not in [
            CommunityMembership.Role.OWNER,
            CommunityMembership.Role.ADMIN,
        ]:
            return Response(
                {'detail': 'Only admins can cancel challenges.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        challenge.status = Challenge.Status.CANCELLED
        challenge.save(update_fields=['status'])

        return Response({'detail': f'Challenge "{challenge.title}" cancelled.'})

    @action(detail=True, methods=['post'])
    def join(self, request, community_id=None, pk=None):
        """Join a challenge. User must be an active community member."""
        challenge = self.get_object()

        # Must be active community member
        membership = CommunityMembership.objects.filter(
            community=challenge.community,
            user=request.user,
            status=CommunityMembership.Status.ACTIVE,
        ).first()

        if not membership:
            return Response(
                {'detail': 'You must be a community member to join challenges.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Challenge must be active or upcoming
        if challenge.current_status not in [
            Challenge.Status.ACTIVE,
            Challenge.Status.UPCOMING,
        ]:
            return Response(
                {'detail': 'This challenge is no longer accepting participants.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        participant, created = ChallengeParticipant.objects.get_or_create(
            challenge=challenge,
            user=request.user,
        )

        if not created:
            return Response(
                {'detail': 'You have already joined this challenge.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {'detail': f'You joined "{challenge.title}"!'},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def leave(self, request, community_id=None, pk=None):
        """Leave a challenge."""
        challenge = self.get_object()

        deleted, _ = ChallengeParticipant.objects.filter(
            challenge=challenge,
            user=request.user,
        ).delete()

        if deleted:
            return Response({'detail': 'You left the challenge.'})

        return Response(
            {'detail': 'You are not in this challenge.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
        
class ChallengeFeedView(APIView):
    """
    GET /api/v1/challenges/feed/
    Returns two lists:
      - my_challenges: active/upcoming challenges from communities I'm a member of
      - discover_challenges: active/upcoming challenges from PUBLIC communities I'm NOT a member of
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.utils import timezone
        now = timezone.now()

        user = request.user

        # Communities the user is an active member of
        my_community_ids = CommunityMembership.objects.filter(
            user=user,
            status=CommunityMembership.Status.ACTIVE,
        ).values_list('community_id', flat=True)

        # --- My Challenges: active/upcoming from my communities ---
        my_challenges = Challenge.objects.filter(
            community_id__in=my_community_ids,
            status__in=[Challenge.Status.ACTIVE, Challenge.Status.UPCOMING],
        ).select_related('community', 'created_by')

        # Sync statuses
        for c in my_challenges:
            c.sync_status()

        # Re-fetch after sync (status might have changed)
        my_challenges = Challenge.objects.filter(
            community_id__in=my_community_ids,
            status__in=[Challenge.Status.ACTIVE, Challenge.Status.UPCOMING],
        ).select_related('community', 'created_by')

        # --- Discover Challenges: active/upcoming from PUBLIC communities I'm NOT in ---
        discover_challenges = Challenge.objects.filter(
            community__visibility=Community.Visibility.PUBLIC,
            status__in=[Challenge.Status.ACTIVE, Challenge.Status.UPCOMING],
        ).exclude(
            community_id__in=my_community_ids,
        ).select_related('community', 'created_by')

        # Sync statuses
        for c in discover_challenges:
            c.sync_status()

        discover_challenges = Challenge.objects.filter(
            community__visibility=Community.Visibility.PUBLIC,
            status__in=[Challenge.Status.ACTIVE, Challenge.Status.UPCOMING],
        ).exclude(
            community_id__in=my_community_ids,
        ).select_related('community', 'created_by')

        # Serialize both lists
        my_data = ChallengeListSerializer(
            my_challenges, many=True, context={'request': request}
        ).data
        discover_data = ChallengeListSerializer(
            discover_challenges, many=True, context={'request': request}
        ).data

        # Add community name + id to each challenge for the frontend
        # (You'll want to add community_name/community_id to your ChallengeListSerializer too)

        return Response({
            'my_challenges': my_data,
            'discover_challenges': discover_data,
        })

import requests as http_requests

class GeocodeView(APIView):
    """
    GET /api/v1/geocode/?q=Thamel+Kathmandu
    Uses OpenStreetMap Nominatim (free, no API key) to geocode a place name.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {'detail': 'Query parameter "q" is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            resp = http_requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={
                    'q': query,
                    'format': 'json',
                    'limit': 5,
                    'addressdetails': 1,
                },
                headers={'User-Agent': 'StrideUp/1.0'},
                timeout=5,
            )
            results = resp.json()

            places = [
                {
                    'name': r.get('display_name', ''),
                    'latitude': float(r['lat']),
                    'longitude': float(r['lon']),
                }
                for r in results
            ]
            return Response(places)
        except Exception as e:
            return Response(
                {'detail': f'Geocoding failed: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )