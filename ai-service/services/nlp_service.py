import asyncio
import logging
import re
from typing import Dict, List, Any, Optional
import spacy
import nltk
from textblob import TextBlob
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
import numpy as np
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class NLPService:
    def __init__(self):
        self.nlp = None
        self.vectorizer = None
        self.kmeans = None
        self.is_initialized = False
        
        # Transaction categories
        self.transaction_categories = {
            "food_dining": ["restaurant", "food", "dining", "cafe", "coffee", "lunch", "dinner"],
            "transportation": ["taxi", "uber", "lyft", "bus", "train", "gas", "fuel", "parking"],
            "shopping": ["store", "shop", "mall", "amazon", "purchase", "buy", "retail"],
            "entertainment": ["movie", "cinema", "theater", "concert", "game", "entertainment"],
            "utilities": ["electric", "water", "gas", "internet", "phone", "utility", "bill"],
            "healthcare": ["doctor", "hospital", "pharmacy", "medical", "health", "clinic"],
            "education": ["school", "university", "course", "education", "tuition", "book"],
            "travel": ["hotel", "flight", "travel", "vacation", "trip", "booking"],
            "groceries": ["grocery", "supermarket", "food", "grocery store", "market"],
            "other": ["miscellaneous", "other", "unknown", "general"]
        }

    async def initialize(self):
        """Initialize the NLP service"""
        try:
            # Load spaCy model
            self.nlp = spacy.load("en_core_web_sm")
            
            # Initialize TF-IDF vectorizer
            self.vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2)
            )
            
            # Initialize K-means for text clustering
            self.kmeans = KMeans(n_clusters=10, random_state=42)
            
            self.is_initialized = True
            logger.info("NLP service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize NLP service: {e}")
            raise

    def is_ready(self) -> bool:
        """Check if the service is ready"""
        return self.is_initialized and self.nlp is not None

    async def detect_intent(self, text: str) -> Dict[str, Any]:
        """Detect intent from text"""
        try:
            if not self.is_ready():
                raise Exception("NLP service not initialized")
            
            doc = self.nlp(text.lower())
            
            # Simple intent detection based on keywords
            intents = {
                "send_money": ["send", "transfer", "pay", "give"],
                "receive_money": ["receive", "get", "collect", "earn"],
                "check_balance": ["balance", "amount", "money", "funds"],
                "transaction_history": ["history", "transactions", "past", "previous"],
                "help": ["help", "support", "assist", "guide"],
                "security": ["security", "safe", "secure", "protect"],
                "currency": ["currency", "exchange", "convert", "rate"]
            }
            
            intent_scores = {}
            for intent, keywords in intents.items():
                score = sum(1 for keyword in keywords if keyword in text.lower())
                intent_scores[intent] = score
            
            # Get the intent with highest score
            best_intent = max(intent_scores, key=intent_scores.get) if intent_scores else "general"
            confidence = intent_scores[best_intent] / len(text.split()) if text.split() else 0
            
            # Extract entities
            entities = []
            for ent in doc.ents:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char
                })
            
            return {
                "intent": best_intent,
                "confidence": min(confidence, 1.0),
                "entities": entities
            }
            
        except Exception as e:
            logger.error(f"Error detecting intent: {e}")
            return {
                "intent": "general",
                "confidence": 0.0,
                "entities": []
            }

    async def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities from text"""
        try:
            if not self.is_ready():
                raise Exception("NLP service not initialized")
            
            doc = self.nlp(text)
            entities = []
            
            for ent in doc.ents:
                entities.append({
                    "text": ent.text,
                    "label": ent.label_,
                    "start": ent.start_char,
                    "end": ent.end_char,
                    "description": spacy.explain(ent.label_)
                })
            
            # Extract custom entities (amounts, currencies, etc.)
            custom_entities = self._extract_custom_entities(text)
            entities.extend(custom_entities)
            
            return entities
            
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            return []

    def _extract_custom_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract custom entities like amounts, currencies, etc."""
        entities = []
        
        # Extract amounts
        amount_pattern = r'\$?(\d+(?:\.\d{2})?)'
        amounts = re.findall(amount_pattern, text)
        for amount in amounts:
            entities.append({
                "text": amount,
                "label": "MONEY",
                "start": text.find(amount),
                "end": text.find(amount) + len(amount),
                "description": "Monetary amount"
            })
        
        # Extract currencies
        currency_pattern = r'\b(USD|EUR|GBP|JPY|INR|CAD|AUD|BTC|ETH|MATIC)\b'
        currencies = re.findall(currency_pattern, text.upper())
        for currency in currencies:
            entities.append({
                "text": currency,
                "label": "CURRENCY",
                "start": text.upper().find(currency),
                "end": text.upper().find(currency) + len(currency),
                "description": "Currency code"
            })
        
        # Extract email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        for email in emails:
            entities.append({
                "text": email,
                "label": "EMAIL",
                "start": text.find(email),
                "end": text.find(email) + len(email),
                "description": "Email address"
            })
        
        # Extract phone numbers
        phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
        phones = re.findall(phone_pattern, text)
        for phone in phones:
            entities.append({
                "text": phone,
                "label": "PHONE",
                "start": text.find(phone),
                "end": text.find(phone) + len(phone),
                "description": "Phone number"
            })
        
        return entities

    async def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of text"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Determine sentiment label
            if polarity > 0.1:
                sentiment = "positive"
            elif polarity < -0.1:
                sentiment = "negative"
            else:
                sentiment = "neutral"
            
            return {
                "sentiment": sentiment,
                "confidence": abs(polarity),
                "scores": {
                    "polarity": polarity,
                    "subjectivity": subjectivity
                }
            }
            
        except Exception as e:
            logger.error(f"Error analyzing sentiment: {e}")
            return {
                "sentiment": "neutral",
                "confidence": 0.0,
                "scores": {
                    "polarity": 0.0,
                    "subjectivity": 0.0
                }
            }

    async def categorize_transaction(
        self,
        description: str,
        amount: float,
        merchant: Optional[str] = None
    ) -> Dict[str, Any]:
        """Categorize transaction based on description"""
        try:
            if not self.is_ready():
                raise Exception("NLP service not initialized")
            
            # Combine description and merchant for analysis
            text = f"{description} {merchant or ''}".lower()
            
            # Calculate category scores
            category_scores = {}
            for category, keywords in self.transaction_categories.items():
                score = sum(1 for keyword in keywords if keyword in text)
                category_scores[category] = score
            
            # Get the category with highest score
            if category_scores:
                best_category = max(category_scores, key=category_scores.get)
                confidence = category_scores[best_category] / len(text.split()) if text.split() else 0
            else:
                best_category = "other"
                confidence = 0.0
            
            # Generate tags
            tags = self._generate_tags(text, amount)
            
            return {
                "category": best_category,
                "confidence": min(confidence, 1.0),
                "tags": tags
            }
            
        except Exception as e:
            logger.error(f"Error categorizing transaction: {e}")
            return {
                "category": "other",
                "confidence": 0.0,
                "tags": []
            }

    def _generate_tags(self, text: str, amount: float) -> List[str]:
        """Generate tags for transaction"""
        tags = []
        
        # Amount-based tags
        if amount > 1000:
            tags.append("high-value")
        elif amount < 10:
            tags.append("low-value")
        
        # Text-based tags
        if any(word in text for word in ["online", "internet", "web"]):
            tags.append("online")
        
        if any(word in text for word in ["recurring", "subscription", "monthly"]):
            tags.append("recurring")
        
        if any(word in text for word in ["refund", "return", "credit"]):
            tags.append("refund")
        
        if any(word in text for word in ["fee", "charge", "cost"]):
            tags.append("fee")
        
        return tags

    async def analyze_transaction(
        self,
        transaction_id: str,
        user_id: str,
        transaction_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Comprehensive transaction analysis"""
        try:
            description = transaction_data.get("description", "")
            amount = transaction_data.get("amount", 0)
            merchant = transaction_data.get("merchant", "")
            
            # Categorize transaction
            categorization = await self.categorize_transaction(description, amount, merchant)
            
            # Analyze sentiment of description
            sentiment = await self.analyze_sentiment(description)
            
            # Generate insights
            insights = self._generate_insights(transaction_data, categorization, sentiment)
            
            # Generate recommendations
            recommendations = self._generate_recommendations(transaction_data, categorization)
            
            return {
                "category": categorization["category"],
                "confidence": categorization["confidence"],
                "tags": categorization["tags"],
                "insights": insights,
                "recommendations": recommendations
            }
            
        except Exception as e:
            logger.error(f"Error analyzing transaction: {e}")
            return {
                "category": "other",
                "confidence": 0.0,
                "tags": [],
                "insights": ["Unable to analyze transaction"],
                "recommendations": ["Manual review recommended"]
            }

    def _generate_insights(
        self,
        transaction_data: Dict[str, Any],
        categorization: Dict[str, Any],
        sentiment: Dict[str, Any]
    ) -> List[str]:
        """Generate insights from transaction analysis"""
        insights = []
        
        amount = transaction_data.get("amount", 0)
        category = categorization["category"]
        
        # Amount insights
        if amount > 500:
            insights.append("High-value transaction detected")
        
        # Category insights
        if category == "food_dining":
            insights.append("Dining expense - consider budgeting for meals")
        elif category == "transportation":
            insights.append("Transportation cost - track for tax deductions")
        elif category == "entertainment":
            insights.append("Entertainment expense - monitor discretionary spending")
        
        # Sentiment insights
        if sentiment["sentiment"] == "negative":
            insights.append("Transaction description suggests dissatisfaction")
        
        # Time-based insights
        hour = datetime.now().hour
        if hour < 6 or hour > 22:
            insights.append("Late night transaction - unusual timing")
        
        return insights

    def _generate_recommendations(
        self,
        transaction_data: Dict[str, Any],
        categorization: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations based on transaction analysis"""
        recommendations = []
        
        amount = transaction_data.get("amount", 0)
        category = categorization["category"]
        
        # Budgeting recommendations
        if category in ["food_dining", "entertainment"]:
            recommendations.append("Consider setting a monthly budget for this category")
        
        # Savings recommendations
        if amount > 100:
            recommendations.append("Consider if this expense aligns with your financial goals")
        
        # Security recommendations
        if "online" in categorization.get("tags", []):
            recommendations.append("Verify this is a legitimate online transaction")
        
        return recommendations

    async def summarize_text(self, text: str, max_length: int = 100) -> str:
        """Summarize text"""
        try:
            if not self.is_ready():
                raise Exception("NLP service not initialized")
            
            doc = self.nlp(text)
            
            # Extract sentences
            sentences = [sent.text for sent in doc.sents]
            
            if len(sentences) <= 1:
                return text[:max_length]
            
            # Simple extractive summarization
            # In production, use more sophisticated methods
            if len(text) <= max_length:
                return text
            
            # Take first sentence or truncate
            first_sentence = sentences[0]
            if len(first_sentence) <= max_length:
                return first_sentence
            else:
                return first_sentence[:max_length-3] + "..."
                
        except Exception as e:
            logger.error(f"Error summarizing text: {e}")
            return text[:max_length] if len(text) > max_length else text

    async def extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text"""
        try:
            if not self.is_ready():
                raise Exception("NLP service not initialized")
            
            doc = self.nlp(text)
            
            # Extract keywords (nouns, adjectives, proper nouns)
            keywords = []
            for token in doc:
                if (token.pos_ in ['NOUN', 'ADJ', 'PROPN'] and 
                    not token.is_stop and 
                    not token.is_punct and 
                    len(token.text) > 2):
                    keywords.append(token.lemma_.lower())
            
            # Remove duplicates and return top keywords
            unique_keywords = list(set(keywords))
            return unique_keywords[:max_keywords]
            
        except Exception as e:
            logger.error(f"Error extracting keywords: {e}")
            return []

    async def detect_language(self, text: str) -> str:
        """Detect language of text"""
        try:
            # Simple language detection based on common words
            # In production, use a proper language detection library
            english_words = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
            spanish_words = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le']
            french_words = ['le', 'la', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour']
            
            text_lower = text.lower()
            
            english_score = sum(1 for word in english_words if word in text_lower)
            spanish_score = sum(1 for word in spanish_words if word in text_lower)
            french_score = sum(1 for word in french_words if word in text_lower)
            
            if english_score > spanish_score and english_score > french_score:
                return "en"
            elif spanish_score > french_score:
                return "es"
            elif french_score > 0:
                return "fr"
            else:
                return "en"  # Default to English
                
        except Exception as e:
            logger.error(f"Error detecting language: {e}")
            return "en"

    async def cleanup(self):
        """Cleanup resources"""
        try:
            logger.info("NLP service cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")