import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import openai
from langchain.llms import OpenAI
from langchain.chains import ConversationChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
import redis
from database.database import get_database

logger = logging.getLogger(__name__)

class ChatbotService:
    def __init__(self):
        self.openai_client = None
        self.llm = None
        self.conversation_chain = None
        self.memory = None
        self.redis_client = None
        self.is_initialized = False
        
        # Chatbot configuration
        self.system_prompt = """
        You are GlobalAi Payee, an AI assistant for a global payment and wallet platform. 
        You help users with:
        - Sending and receiving money
        - Currency conversion
        - Transaction history
        - Wallet management
        - Security and fraud protection
        - Blockchain and crypto transactions
        - Location-based payments
        - General financial advice
        
        Always be helpful, accurate, and security-conscious. If you're unsure about something, 
        ask for clarification or direct users to contact support.
        
        Current context: {context}
        User ID: {user_id}
        """
        
        self.intent_patterns = {
            "send_money": [
                "send money", "transfer", "pay", "send to", "send cash"
            ],
            "receive_money": [
                "receive money", "get paid", "receive payment", "money received"
            ],
            "check_balance": [
                "balance", "how much", "check balance", "wallet balance"
            ],
            "transaction_history": [
                "history", "transactions", "past payments", "transaction log"
            ],
            "currency_conversion": [
                "convert", "exchange rate", "currency", "change currency"
            ],
            "security": [
                "security", "fraud", "safe", "secure", "protection"
            ],
            "help": [
                "help", "support", "how to", "guide", "tutorial"
            ],
            "crypto": [
                "crypto", "bitcoin", "ethereum", "blockchain", "cryptocurrency"
            ]
        }

    async def initialize(self):
        """Initialize the chatbot service"""
        try:
            # Initialize OpenAI client
            openai.api_key = os.getenv("OPENAI_API_KEY")
            self.openai_client = openai
            
            # Initialize LangChain
            self.llm = OpenAI(
                temperature=0.7,
                max_tokens=500,
                openai_api_key=os.getenv("OPENAI_API_KEY")
            )
            
            # Initialize conversation memory
            self.memory = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True
            )
            
            # Initialize conversation chain
            prompt = PromptTemplate(
                input_variables=["chat_history", "input", "context", "user_id"],
                template=f"{self.system_prompt}\n\nChat History: {{chat_history}}\nHuman: {{input}}\nAI:"
            )
            
            self.conversation_chain = ConversationChain(
                llm=self.llm,
                memory=self.memory,
                prompt=prompt,
                verbose=True
            )
            
            # Initialize Redis for session management
            self.redis_client = redis.Redis(
                host=os.getenv("REDIS_HOST", "localhost"),
                port=int(os.getenv("REDIS_PORT", 6379)),
                db=0,
                decode_responses=True
            )
            
            self.is_initialized = True
            logger.info("Chatbot service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize chatbot service: {e}")
            raise

    def is_ready(self) -> bool:
        """Check if the service is ready"""
        return self.is_initialized and self.openai_client is not None

    async def process_message(
        self, 
        message: str, 
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a chat message and return response"""
        try:
            if not self.is_ready():
                raise Exception("Chatbot service not initialized")
            
            # Generate session ID if not provided
            if not session_id:
                session_id = f"session_{user_id}_{datetime.now().timestamp()}"
            
            # Detect intent
            intent = await self._detect_intent(message)
            
            # Extract entities
            entities = await self._extract_entities(message)
            
            # Get or create session
            session_data = await self._get_session(session_id)
            
            # Prepare context
            context_str = json.dumps(context or {})
            
            # Generate response
            response = await self._generate_response(
                message=message,
                context=context_str,
                user_id=user_id or "anonymous",
                session_id=session_id,
                intent=intent,
                entities=entities
            )
            
            # Update session
            await self._update_session(session_id, message, response)
            
            # Generate suggestions
            suggestions = await self._generate_suggestions(intent, entities)
            
            return {
                "response": response,
                "intent": intent,
                "confidence": 0.9,  # Placeholder
                "entities": entities,
                "suggestions": suggestions,
                "session_id": session_id
            }
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "response": "I'm sorry, I encountered an error. Please try again or contact support.",
                "intent": "error",
                "confidence": 0.0,
                "entities": [],
                "suggestions": ["Contact support", "Try again"],
                "session_id": session_id or "error"
            }

    async def _detect_intent(self, message: str) -> str:
        """Detect user intent from message"""
        message_lower = message.lower()
        
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if pattern in message_lower:
                    return intent
        
        return "general"

    async def _extract_entities(self, message: str) -> List[Dict[str, Any]]:
        """Extract entities from message"""
        entities = []
        
        # Simple entity extraction (in production, use spaCy or similar)
        import re
        
        # Extract amounts
        amount_pattern = r'\$?(\d+(?:\.\d{2})?)'
        amounts = re.findall(amount_pattern, message)
        for amount in amounts:
            entities.append({
                "type": "amount",
                "value": float(amount),
                "text": amount
            })
        
        # Extract currencies
        currency_pattern = r'\b(USD|EUR|GBP|JPY|INR|CAD|AUD|BTC|ETH)\b'
        currencies = re.findall(currency_pattern, message.upper())
        for currency in currencies:
            entities.append({
                "type": "currency",
                "value": currency,
                "text": currency
            })
        
        # Extract email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, message)
        for email in emails:
            entities.append({
                "type": "email",
                "value": email,
                "text": email
            })
        
        return entities

    async def _generate_response(
        self, 
        message: str, 
        context: str, 
        user_id: str, 
        session_id: str,
        intent: str,
        entities: List[Dict[str, Any]]
    ) -> str:
        """Generate AI response"""
        try:
            # Prepare context for the AI
            context_info = {
                "user_id": user_id,
                "session_id": session_id,
                "intent": intent,
                "entities": entities,
                "timestamp": datetime.now().isoformat()
            }
            
            # Use OpenAI API for response generation
            response = await self.openai_client.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": self.system_prompt.format(
                            context=context,
                            user_id=user_id
                        )
                    },
                    {
                        "role": "user",
                        "content": message
                    }
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I'm sorry, I'm having trouble processing your request right now. Please try again later."

    async def _generate_suggestions(self, intent: str, entities: List[Dict[str, Any]]) -> List[str]:
        """Generate helpful suggestions based on intent and entities"""
        suggestions = []
        
        if intent == "send_money":
            suggestions = [
                "Enter recipient's email or phone number",
                "Specify the amount to send",
                "Choose the currency"
            ]
        elif intent == "check_balance":
            suggestions = [
                "View all wallet balances",
                "Check transaction history",
                "Set up balance alerts"
            ]
        elif intent == "transaction_history":
            suggestions = [
                "Filter by date range",
                "Search by amount or recipient",
                "Export transaction history"
            ]
        elif intent == "currency_conversion":
            suggestions = [
                "Check current exchange rates",
                "Convert between currencies",
                "Set up rate alerts"
            ]
        elif intent == "security":
            suggestions = [
                "Enable two-factor authentication",
                "Review security settings",
                "Check recent login activity"
            ]
        else:
            suggestions = [
                "How can I help you today?",
                "Need help with payments?",
                "Want to check your balance?"
            ]
        
        return suggestions

    async def _get_session(self, session_id: str) -> Dict[str, Any]:
        """Get or create session data"""
        try:
            session_data = self.redis_client.get(f"chat_session:{session_id}")
            if session_data:
                return json.loads(session_data)
            else:
                return {
                    "session_id": session_id,
                    "created_at": datetime.now().isoformat(),
                    "message_count": 0,
                    "context": {}
                }
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return {
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "message_count": 0,
                "context": {}
            }

    async def _update_session(self, session_id: str, message: str, response: str):
        """Update session data"""
        try:
            session_data = await self._get_session(session_id)
            session_data["message_count"] += 1
            session_data["last_activity"] = datetime.now().isoformat()
            
            # Store in Redis with 24-hour expiration
            self.redis_client.setex(
                f"chat_session:{session_id}",
                86400,  # 24 hours
                json.dumps(session_data)
            )
        except Exception as e:
            logger.error(f"Error updating session: {e}")

    async def get_conversation_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a session"""
        try:
            history = self.redis_client.lrange(f"chat_history:{session_id}", 0, -1)
            return [json.loads(msg) for msg in history]
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    async def clear_session(self, session_id: str):
        """Clear session data"""
        try:
            self.redis_client.delete(f"chat_session:{session_id}")
            self.redis_client.delete(f"chat_history:{session_id}")
        except Exception as e:
            logger.error(f"Error clearing session: {e}")

    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.redis_client:
                self.redis_client.close()
            logger.info("Chatbot service cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Import os at the top
import os