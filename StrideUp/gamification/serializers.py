from rest_framework import serializers
from .models import PointBalance, PointTransaction, RankTier

class RankTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = RankTier
        fields = ['name', 'color_hex', 'icon_name', 'min_lifetime_points']

class PointBalanceSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    tier = serializers.SerializerMethodField()
    next_tier = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = PointBalance
        fields = [
            'username', 'balance', 'lifetime_earned', 'updated_at',
            'tier', 'next_tier', 'progress_percentage'
        ]

    def get_tier_info(self, obj):
        # We cache the calculation on the object instance so we don't 
        # hit the database multiple times when serializing a single response.
        if not hasattr(obj, '_cached_tier_info'):
            obj._cached_tier_info = obj.get_tier_info()
        return obj._cached_tier_info

    def get_tier(self, obj):
        info = self.get_tier_info(obj)
        if info and info['current_tier']:
            return RankTierSerializer(info['current_tier']).data
        return None

    def get_next_tier(self, obj):
        info = self.get_tier_info(obj)
        if info and info['next_tier']:
            return RankTierSerializer(info['next_tier']).data
        return None

    def get_progress_percentage(self, obj):
        info = self.get_tier_info(obj)
        return info['progress_percentage'] if info else 0


class PointTransactionSerializer(serializers.ModelSerializer):
    activity_title = serializers.SerializerMethodField()

    class Meta:
        model = PointTransaction
        fields = [
            'id', 'amount', 'transaction_type', 'reason',
            'activity_title', 'balance_after', 'created_at',
        ]

    def get_activity_title(self, obj):
        if obj.activity:
            return obj.activity.title
        return None


class SampleVoucherSerializer(serializers.Serializer):
    """Serializer for static sample vouchers (no DB model yet)"""
    id = serializers.IntegerField()
    title = serializers.CharField()
    brand = serializers.CharField()
    description = serializers.CharField()
    category = serializers.CharField()
    discount_percent = serializers.IntegerField(required=False)
    discount_amount = serializers.IntegerField(required=False)
    points_cost = serializers.IntegerField()
    image_url = serializers.URLField()