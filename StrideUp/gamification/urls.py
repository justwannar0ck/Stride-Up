from django.urls import path
from . import views

urlpatterns = [
    path('gamification/balance/', views.PointBalanceView.as_view(), name='point-balance'),
    path('gamification/vouchers/', views.SampleVouchersView.as_view(), name='sample-vouchers'),
]