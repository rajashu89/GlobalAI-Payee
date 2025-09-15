# GlobalAi Payee - Universal AI + Blockchain Wallet

A comprehensive, production-ready universal AI + Blockchain-powered wallet application that works globally with location-based detection, automatic currency conversion, and seamless offline + online transactions.

## 🌟 Features

### Core Functionality
- **Universal Wallet**: Support for multiple currencies (USD, EUR, GBP, JPY, INR, etc.)
- **Blockchain Integration**: Ethereum, Polygon, and Binance Smart Chain support
- **AI-Powered Security**: Fraud detection and anomaly detection using machine learning
- **Location-Based Payments**: Automatic currency conversion based on user location
- **QR Code Payments**: Generate and scan QR codes for instant payments
- **Real-Time Chat**: AI chatbot for financial assistance and support

### Security Features
- **End-to-End Encryption**: AES-256 + RSA encryption for all transactions
- **Multi-Factor Authentication**: TOTP-based 2FA support
- **Fraud Detection**: AI-powered transaction monitoring and risk assessment
- **Smart Contracts**: Immutable transaction logging on blockchain
- **GDPR & PCI DSS Compliance**: Full regulatory compliance

### Technical Features
- **Responsive Design**: Mobile-first design with PWA capabilities
- **Real-Time Updates**: WebSocket integration for live transaction updates
- **Offline Support**: Service worker for offline functionality
- **Multi-Language Support**: Internationalization ready
- **Dark Mode**: Complete dark/light theme support

## 🏗️ Architecture

### Backend (Node.js/Express)
- **RESTful API**: Comprehensive API with authentication and authorization
- **Database**: PostgreSQL for transactional data, MongoDB for logs
- **Caching**: Redis for session management and performance optimization
- **Real-Time**: Socket.IO for live updates and notifications
- **Security**: JWT authentication, rate limiting, input validation

### AI Service (Python/FastAPI)
- **Chatbot**: Natural language processing for user assistance
- **Fraud Detection**: Machine learning models for transaction analysis
- **NLP**: Text analysis, sentiment analysis, and entity extraction
- **Model Management**: Automated model training and deployment

### Frontend (React/Next.js)
- **Modern UI**: TailwindCSS with custom components
- **State Management**: React Query for server state, Context for app state
- **Web3 Integration**: Ethers.js for blockchain interactions
- **Real-Time**: Socket.IO client for live updates
- **PWA**: Progressive Web App capabilities

### Blockchain (Solidity)
- **Smart Contracts**: Multi-signature wallet and token vault
- **Cross-Chain**: Support for multiple blockchain networks
- **Gas Optimization**: Efficient contract design for cost reduction
- **Security**: Comprehensive security audits and best practices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- PostgreSQL 15+
- MongoDB 7+
- Redis 7+
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/globalai-payee.git
cd globalai-payee
```

2. **Install dependencies**
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../ai-service && pip install -r requirements.txt
cd ../smart-contracts && npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database Setup**
```bash
# Start databases with Docker
docker-compose up -d postgres mongodb redis

# Or install locally and run migrations
cd backend && npm run migrate
```

5. **Start Development Servers**
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Backend API (port 3001)
npm run dev:frontend   # Frontend (port 3000)
npm run dev:ai         # AI Service (port 8001)
```

### Docker Deployment

1. **Build and start all services**
```bash
docker-compose up --build
```

2. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- AI Service: http://localhost:8001
- Database Admin: http://localhost:8080 (pgAdmin)

## 📁 Project Structure

```
globalai-payee/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database, Redis, Socket config
│   │   ├── controllers/    # API route handlers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React/Next.js application
│   ├── app/               # Next.js 13+ app directory
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── types/             # TypeScript type definitions
│   └── public/            # Static assets
├── ai-service/            # Python/FastAPI AI service
│   ├── services/          # AI service implementations
│   ├── models/            # ML models and training
│   ├── utils/             # Utility functions
│   └── requirements.txt
├── smart-contracts/       # Solidity smart contracts
│   ├── contracts/         # Smart contract source code
│   ├── scripts/           # Deployment scripts
│   ├── test/              # Contract tests
│   └── hardhat.config.js
├── database/              # Database schemas and migrations
│   └── init.sql          # PostgreSQL initialization
├── docker-compose.yml     # Docker orchestration
├── .env.example          # Environment variables template
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/globalai_payee
MONGODB_URI=mongodb://admin:password@localhost:27017/globalai_logs
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# API Keys
BINANCE_API_KEY=your-binance-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
OPENEXCHANGE_API_KEY=your-openexchange-api-key
OPENAI_API_KEY=your-openai-api-key

# Blockchain Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your-key
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8001
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### API Keys Setup

1. **Google Maps API**: Get API key from [Google Cloud Console](https://console.cloud.google.com/)
2. **OpenExchange Rates**: Sign up at [OpenExchangeRates](https://openexchangerates.org/)
3. **Binance API**: Get API keys from [Binance](https://www.binance.com/)
4. **OpenAI API**: Get API key from [OpenAI](https://platform.openai.com/)

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
npm run test:coverage
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### Smart Contract Tests
```bash
cd smart-contracts
npm test
npm run coverage
```

### AI Service Tests
```bash
cd ai-service
python -m pytest
python -m pytest --cov=services
```

## 🚀 Deployment

### Production Deployment

1. **Build for production**
```bash
npm run build
```

2. **Deploy with Docker**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **Environment-specific configuration**
- Update environment variables for production
- Configure SSL certificates
- Set up monitoring and logging
- Configure backup strategies

### Cloud Deployment

#### AWS Deployment
```bash
# Deploy to AWS ECS
aws ecs create-cluster --cluster-name globalai-payee
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs create-service --cluster globalai-payee --service-name api --task-definition globalai-payee
```

#### Google Cloud Deployment
```bash
# Deploy to Google Cloud Run
gcloud run deploy globalai-payee-api --source ./backend
gcloud run deploy globalai-payee-frontend --source ./frontend
gcloud run deploy globalai-payee-ai --source ./ai-service
```

## 📊 Monitoring & Analytics

### Health Checks
- Backend: `GET /health`
- AI Service: `GET /health`
- Database connectivity monitoring
- Redis connectivity monitoring

### Metrics
- Transaction volume and success rates
- User engagement metrics
- AI model performance
- System performance metrics

### Logging
- Structured logging with Winston
- Error tracking and alerting
- Audit logs for compliance
- Performance monitoring

## 🔒 Security

### Security Features
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control
- **Encryption**: End-to-end encryption for sensitive data
- **Rate Limiting**: API rate limiting and DDoS protection
- **Input Validation**: Comprehensive input sanitization
- **CORS**: Proper CORS configuration
- **HTTPS**: SSL/TLS encryption in production

### Security Best Practices
- Regular security audits
- Dependency vulnerability scanning
- Code quality checks
- Penetration testing
- Compliance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write comprehensive tests
- Update documentation
- Follow security best practices
- Use conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs.globalai-payee.com](https://docs.globalai-payee.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/globalai-payee/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/globalai-payee/discussions)
- **Email**: support@globalai-payee.com

## 🙏 Acknowledgments

- OpenZeppelin for smart contract libraries
- Next.js team for the amazing framework
- TailwindCSS for the utility-first CSS framework
- The open-source community for various dependencies

---

**Built with ❤️ by the GlobalAi Payee Team**