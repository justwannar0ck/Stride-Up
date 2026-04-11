from django.contrib import admin
from .models import PointBalance, PointTransaction, RankTier

@admin.register(PointBalance)
class PointBalanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'balance', 'lifetime_earned', 'updated_at']
    search_fields = ['user__username']
    readonly_fields = ['updated_at']

@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'transaction_type', 'reason', 'balance_after', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['user__username', 'reason']
    readonly_fields = ['created_at']
    
@admin.register(RankTier)
class RankTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_lifetime_points', 'color_hex', 'icon_name')
    ordering = ('min_lifetime_points',)