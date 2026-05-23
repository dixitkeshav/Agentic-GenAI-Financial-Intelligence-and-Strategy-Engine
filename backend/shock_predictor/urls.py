from django.urls import path
from . import views

urlpatterns = [
    path('score/', views.current_score),
    path('history/', views.shock_history),
    path('alerts/', views.alert_log),
    path('patterns/', views.precursor_patterns),
]
