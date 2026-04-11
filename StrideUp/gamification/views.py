from rest_framework import status, permissions, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import PointBalance, PointTransaction
from .serializers import (
    PointBalanceSerializer,
    PointTransactionSerializer,
    SampleVoucherSerializer,
)
from .sample_vouchers import SAMPLE_VOUCHERS


class PointBalanceView(APIView):
    """current user's point balance."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        balance, _ = PointBalance.objects.get_or_create(user=request.user)
        serializer = PointBalanceSerializer(balance)
        return Response(serializer.data)


class PointHistoryView(generics.ListAPIView):
    """user's point transaction log."""
    serializer_class = PointTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return PointTransaction.objects.filter(user=self.request.user)


class SampleVouchersView(APIView):
    """
    These are display-only for the frontend to show example rewards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        balance, _ = PointBalance.objects.get_or_create(user=request.user)

        vouchers = []
        for v in SAMPLE_VOUCHERS:
            voucher = dict(v)
            voucher['can_afford'] = balance.balance >= v['points_cost']
            vouchers.append(voucher)

        return Response({
            'user_balance': balance.balance,
            'vouchers': vouchers,
        })