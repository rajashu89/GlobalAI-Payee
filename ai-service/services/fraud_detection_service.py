import asyncio
import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
import redis
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import os
from database.database import get_database

logger = logging.getLogger(__name__)

class FraudDetectionService:
    def __init__(self):
        self.isolation_forest = None
        self.random_forest = None
        self.scaler = None
        self.redis_client = None
        self.is_initialized = False
        
        # Fraud detection thresholds
        self.fraud_thresholds = {
            "low": 0.3,
            "medium": 0.6,
            "high": 0.8
        }
        
        # Risk factors and their weights
        self.risk_factors = {
            "amount": 0.25,
            "frequency": 0.20,
            "location": 0.15,
            "time": 0.15,
            "device": 0.10,
            "pattern": 0.15
        }

    async def initialize(self):
        """Initialize the fraud detection service"""
        try:
            # Initialize Redis for caching
            self.redis_client = redis.Redis(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", 6379)),
                db=1,  # Use different DB for fraud detection
                decode_responses=True
            )
            
            # Load or train models
            await self._load_models()
            
            self.is_initialized = True
            logger.info("Fraud detection service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize fraud detection service: {e}")
            raise

    def is_ready(self) -> bool:
        """Check if the service is ready"""
        return self.is_initialized and self.isolation_forest is not None

    async def _load_models(self):
        """Load pre-trained models or train new ones"""
        try:
            models_dir = "models"
            os.makedirs(models_dir, exist_ok=True)
            
            # Try to load existing models
            isolation_model_path = os.path.join(models_dir, "isolation_forest.pkl")
            random_forest_path = os.path.join(models_dir, "random_forest.pkl")
            scaler_path = os.path.join(models_dir, "scaler.pkl")
            
            if (os.path.exists(isolation_model_path) and 
                os.path.exists(random_forest_path) and 
                os.path.exists(scaler_path)):
                
                self.isolation_forest = joblib.load(isolation_model_path)
                self.random_forest = joblib.load(random_forest_path)
                self.scaler = joblib.load(scaler_path)
                
                logger.info("Loaded pre-trained fraud detection models")
            else:
                # Train new models with synthetic data
                await self._train_models()
                
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            await self._train_models()

    async def _train_models(self):
        """Train fraud detection models with synthetic data"""
        try:
            logger.info("Training fraud detection models...")
            
            # Generate synthetic training data
            X_train, y_train = self._generate_synthetic_data()
            
            # Initialize and train Isolation Forest for anomaly detection
            self.isolation_forest = IsolationForest(
                contamination=0.1,  # 10% of data is considered anomalous
                random_state=42
            )
            self.isolation_forest.fit(X_train)
            
            # Initialize and train Random Forest for classification
            self.random_forest = RandomForestClassifier(
                n_estimators=100,
                random_state=42,
                class_weight='balanced'
            )
            self.random_forest.fit(X_train, y_train)
            
            # Initialize and fit scaler
            self.scaler = StandardScaler()
            self.scaler.fit(X_train)
            
            # Save models
            models_dir = "models"
            os.makedirs(models_dir, exist_ok=True)
            
            joblib.dump(self.isolation_forest, os.path.join(models_dir, "isolation_forest.pkl"))
            joblib.dump(self.random_forest, os.path.join(models_dir, "random_forest.pkl"))
            joblib.dump(self.scaler, os.path.join(models_dir, "scaler.pkl"))
            
            logger.info("Fraud detection models trained and saved successfully")
            
        except Exception as e:
            logger.error(f"Error training models: {e}")
            raise

    def _generate_synthetic_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Generate synthetic training data for fraud detection"""
        np.random.seed(42)
        n_samples = 10000
        
        # Generate features
        features = []
        labels = []
        
        for i in range(n_samples):
            # Normal transaction features
            amount = np.random.lognormal(mean=3, sigma=1)  # Log-normal distribution for amounts
            hour = np.random.randint(0, 24)
            day_of_week = np.random.randint(0, 7)
            location_risk = np.random.uniform(0, 1)
            device_risk = np.random.uniform(0, 1)
            frequency_risk = np.random.uniform(0, 1)
            
            # Create feature vector
            feature_vector = [
                amount,
                hour,
                day_of_week,
                location_risk,
                device_risk,
                frequency_risk,
                np.random.uniform(0, 1),  # Additional random feature
                np.random.uniform(0, 1)   # Additional random feature
            ]
            
            # Determine if transaction is fraudulent
            is_fraud = False
            
            # High amount transactions are more likely to be fraud
            if amount > 10000:
                is_fraud = np.random.random() < 0.3
            
            # Unusual hours increase fraud probability
            if hour < 6 or hour > 22:
                is_fraud = is_fraud or np.random.random() < 0.2
            
            # High location risk
            if location_risk > 0.8:
                is_fraud = is_fraud or np.random.random() < 0.4
            
            # High device risk
            if device_risk > 0.8:
                is_fraud = is_fraud or np.random.random() < 0.3
            
            # Random fraud cases
            if np.random.random() < 0.05:  # 5% base fraud rate
                is_fraud = True
            
            features.append(feature_vector)
            labels.append(1 if is_fraud else 0)
        
        return np.array(features), np.array(labels)

    async def analyze_transaction(
        self,
        transaction_data: Dict[str, Any],
        user_id: str,
        amount: float,
        currency: str,
        location: Optional[Dict[str, float]] = None,
        device_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Analyze transaction for fraud"""
        try:
            if not self.is_ready():
                raise Exception("Fraud detection service not initialized")
            
            # Extract features from transaction data
            features = await self._extract_features(
                transaction_data, user_id, amount, currency, location, device_info
            )
            
            # Scale features
            features_scaled = self.scaler.transform([features])
            
            # Get anomaly score from Isolation Forest
            anomaly_score = self.isolation_forest.decision_function(features_scaled)[0]
            anomaly_score = (anomaly_score - self.isolation_forest.offset_) / abs(self.isolation_forest.offset_)
            anomaly_score = max(0, min(1, anomaly_score))  # Normalize to 0-1
            
            # Get fraud probability from Random Forest
            fraud_probability = self.random_forest.predict_proba(features_scaled)[0][1]
            
            # Combine scores
            combined_score = (anomaly_score * 0.4 + fraud_probability * 0.6)
            
            # Determine risk level
            risk_level = self._determine_risk_level(combined_score)
            
            # Generate reasons
            reasons = await self._generate_fraud_reasons(
                features, anomaly_score, fraud_probability, transaction_data
            )
            
            # Generate recommendation
            recommendation = self._generate_recommendation(risk_level, reasons)
            
            # Cache result
            await self._cache_analysis_result(
                user_id, transaction_data.get("id"), combined_score, risk_level
            )
            
            return {
                "fraud_score": float(combined_score),
                "risk_level": risk_level,
                "reasons": reasons,
                "recommendation": recommendation,
                "confidence": float(max(anomaly_score, fraud_probability))
            }
            
        except Exception as e:
            logger.error(f"Error analyzing transaction for fraud: {e}")
            return {
                "fraud_score": 0.5,  # Default medium risk
                "risk_level": "medium",
                "reasons": ["Unable to analyze transaction"],
                "recommendation": "Manual review recommended",
                "confidence": 0.0
            }

    async def _extract_features(
        self,
        transaction_data: Dict[str, Any],
        user_id: str,
        amount: float,
        currency: str,
        location: Optional[Dict[str, float]] = None,
        device_info: Optional[Dict[str, Any]] = None
    ) -> List[float]:
        """Extract features for fraud detection"""
        features = []
        
        # Amount feature (normalized)
        amount_normalized = min(amount / 10000, 1.0)  # Cap at 10k for normalization
        features.append(amount_normalized)
        
        # Time features
        now = datetime.now()
        hour = now.hour
        day_of_week = now.weekday()
        features.extend([hour / 24, day_of_week / 7])
        
        # Location risk
        location_risk = 0.5  # Default medium risk
        if location:
            # Simple location risk based on coordinates
            # In production, use a more sophisticated location risk model
            lat, lng = location.get("lat", 0), location.get("lng", 0)
            location_risk = abs(lat) + abs(lng) / 180  # Simple risk calculation
        features.append(location_risk)
        
        # Device risk
        device_risk = 0.5  # Default medium risk
        if device_info:
            # Check for suspicious device characteristics
            if device_info.get("is_mobile", False):
                device_risk += 0.1
            if device_info.get("is_tor", False):
                device_risk += 0.3
            if device_info.get("is_vpn", False):
                device_risk += 0.2
        features.append(min(device_risk, 1.0))
        
        # Frequency risk (based on user's transaction history)
        frequency_risk = await self._calculate_frequency_risk(user_id, amount)
        features.append(frequency_risk)
        
        # Additional features
        features.extend([
            np.random.uniform(0, 1),  # Placeholder for more sophisticated features
            np.random.uniform(0, 1)   # Placeholder for more sophisticated features
        ])
        
        return features

    async def _calculate_frequency_risk(self, user_id: str, amount: float) -> float:
        """Calculate risk based on transaction frequency"""
        try:
            # Get user's recent transaction count from cache
            cache_key = f"user_transactions:{user_id}"
            recent_transactions = self.redis_client.get(cache_key)
            
            if recent_transactions:
                transaction_count = int(recent_transactions)
            else:
                # Default to medium risk if no history
                transaction_count = 5
            
            # Calculate frequency risk
            if transaction_count < 3:
                return 0.8  # High risk for new users
            elif transaction_count < 10:
                return 0.4  # Medium risk
            else:
                return 0.2  # Low risk for frequent users
                
        except Exception as e:
            logger.error(f"Error calculating frequency risk: {e}")
            return 0.5  # Default medium risk

    def _determine_risk_level(self, fraud_score: float) -> str:
        """Determine risk level based on fraud score"""
        if fraud_score >= self.fraud_thresholds["high"]:
            return "high"
        elif fraud_score >= self.fraud_thresholds["medium"]:
            return "medium"
        else:
            return "low"

    async def _generate_fraud_reasons(
        self,
        features: List[float],
        anomaly_score: float,
        fraud_probability: float,
        transaction_data: Dict[str, Any]
    ) -> List[str]:
        """Generate reasons for fraud risk assessment"""
        reasons = []
        
        # Amount-based reasons
        amount = features[0] * 10000  # Denormalize
        if amount > 5000:
            reasons.append("High transaction amount")
        
        # Time-based reasons
        hour = features[1] * 24
        if hour < 6 or hour > 22:
            reasons.append("Unusual transaction time")
        
        # Location-based reasons
        if features[3] > 0.8:
            reasons.append("High-risk location")
        
        # Device-based reasons
        if features[4] > 0.7:
            reasons.append("Suspicious device characteristics")
        
        # Frequency-based reasons
        if features[5] > 0.7:
            reasons.append("Unusual transaction frequency")
        
        # Anomaly-based reasons
        if anomaly_score > 0.7:
            reasons.append("Transaction pattern anomaly detected")
        
        # Probability-based reasons
        if fraud_probability > 0.6:
            reasons.append("High fraud probability based on historical data")
        
        # Default reason if no specific reasons found
        if not reasons:
            reasons.append("Standard risk assessment")
        
        return reasons

    def _generate_recommendation(self, risk_level: str, reasons: List[str]) -> str:
        """Generate recommendation based on risk level"""
        if risk_level == "high":
            return "Block transaction and require manual review"
        elif risk_level == "medium":
            return "Require additional verification (2FA, SMS)"
        else:
            return "Approve transaction with standard monitoring"

    async def _cache_analysis_result(
        self,
        user_id: str,
        transaction_id: Optional[str],
        fraud_score: float,
        risk_level: str
    ):
        """Cache fraud analysis result"""
        try:
            if transaction_id:
                cache_key = f"fraud_analysis:{transaction_id}"
                result = {
                    "fraud_score": fraud_score,
                    "risk_level": risk_level,
                    "timestamp": datetime.now().isoformat()
                }
                self.redis_client.setex(cache_key, 86400, json.dumps(result))  # 24 hours
        except Exception as e:
            logger.error(f"Error caching analysis result: {e}")

    async def get_user_risk_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user's risk profile"""
        try:
            # Get user's transaction history and calculate risk metrics
            cache_key = f"user_risk_profile:{user_id}"
            profile = self.redis_client.get(cache_key)
            
            if profile:
                return json.loads(profile)
            else:
                # Generate default risk profile
                default_profile = {
                    "overall_risk": "medium",
                    "transaction_count": 0,
                    "avg_amount": 0,
                    "risk_factors": [],
                    "last_updated": datetime.now().isoformat()
                }
                
                # Cache for 1 hour
                self.redis_client.setex(cache_key, 3600, json.dumps(default_profile))
                return default_profile
                
        except Exception as e:
            logger.error(f"Error getting user risk profile: {e}")
            return {
                "overall_risk": "medium",
                "transaction_count": 0,
                "avg_amount": 0,
                "risk_factors": [],
                "last_updated": datetime.now().isoformat()
            }

    async def update_user_risk_profile(self, user_id: str, transaction_data: Dict[str, Any]):
        """Update user's risk profile based on new transaction"""
        try:
            # This would typically update the user's risk profile in the database
            # For now, we'll just log the update
            logger.info(f"Updating risk profile for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error updating user risk profile: {e}")

    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.redis_client:
                self.redis_client.close()
            logger.info("Fraud detection service cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Import numpy at the top
import numpy as np