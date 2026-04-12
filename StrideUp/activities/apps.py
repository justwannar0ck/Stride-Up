import os
from django.apps import AppConfig
import joblib
from django.conf import settings

class ActivitiesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'activities'
    verbose_name = 'Activity Tracking'
    
    # Class variables to hold our models
    distance_classifier = None
    pace_regressor = None

    def ready(self):
        # This ensures models are only loaded once
        model_dir = os.path.join(settings.BASE_DIR, 'ml_models')
        try:
            self.distance_classifier = joblib.load(os.path.join(model_dir, 'strideup_distance_classifier.pkl'))
            self.pace_regressor = joblib.load(os.path.join(model_dir, 'strideup_pace_regressor.pkl'))
        except Exception as e:
            print(f"ML Models not found or failed to load: {e}")