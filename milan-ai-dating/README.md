# Milan AI - Agentic Generative AI Dating Platform

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/react-18+-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/fastapi-0.109+-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
</p>

**Milan AI** is a sophisticated, AI-powered online dating platform specifically designed for the Nepalese market. It employs a multi-agent architecture where autonomous AI agents collaborate to provide intelligent matchmaking, safety moderation, and personalized user experiences.

## 🎯 Features

### Core Features
- 🤖 **AI-Powered Matching** - Advanced algorithms analyze personality, preferences, and compatibility
- 💬 **Smart Conversation Coach** - AI suggests icebreakers and conversation topics
- 🛡️ **Multi-Layer Safety** - Content moderation, fraud detection, and image verification
- 💳 **Nepalese Payment Integration** - Support for Khalti, eSewa, and IME Pay
- 📱 **Real-time Chat** - WebSocket-based messaging system
- 🔐 **Secure Authentication** - JWT-based auth with role-based access control

### AI Agents
1. **Orchestrator Agent** - Central coordinator for all agent interactions
2. **User Profile Agent** - Profile analysis and embedding generation
3. **Matching Agent** - Intelligent compatibility scoring
4. **Conversation Coach** - Conversation suggestions and analysis
5. **Safety Agent** - Content moderation and toxicity detection
6. **Fraud Detection Agent** - Fake account and scam detection
7. **Image Verification Agent** - Photo moderation and verification
8. **Subscription Agent** - Payment processing and billing
9. **Analytics Agent** - Platform insights and reporting
10. **Admin Agent** - Administrative operations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│              (React + TypeScript + Tailwind)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                      API Gateway                             │
│                     (NGINX + SSL)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Auth      │  │   Agents    │  │      Services       │  │
│  │   Router    │  │  (10 AI)    │  │  (Vector, Cache)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
│  PostgreSQL  │ │  Redis   │ │    FAISS    │
│   (Primary)  │ │  (Cache) │ │ (Vector DB) │
└──────────────┘ └──────────┘ └─────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.11+ (for local backend development)

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/Vaskoor/milan-ai.git
cd milan-ai

# Set environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost/api/v1
# API Docs: http://localhost/docs
```

### Local Development

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 📁 Project Structure

```
milan-ai/
├── backend/
│   ├── app/
│   │   ├── agents/          # AI agent implementations
│   │   ├── api/             # API routers
│   │   ├── core/            # Config & security
│   │   ├── db/              # Database models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── main.py          # FastAPI app
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API services
│   │   └── types/           # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker/
│   └── nginx.conf           # NGINX configuration
├── docs/
│   ├── ARCHITECTURE.md      # Architecture documentation
│   └── DATABASE_SCHEMA.sql  # Database schema
└── docker-compose.yml
```

## 💳 Subscription Plans (NPR)

| Plan | Price | Features |
|------|-------|----------|
| **Free** | Rs. 0 | 50 swipes/day, Basic matching |
| **Basic** | Rs. 499/month | 100 swipes/day, See who liked you, Advanced filters |
| **Premium** | Rs. 999/month | Unlimited swipes, AI assistant, Read receipts, Profile boost |
| **Elite** | Rs. 1999/month | Everything + Incognito mode, Priority support, Exclusive matches |

## 🔧 Environment Variables

### Backend (.env)
```env
# Security
SECRET_KEY=your-secret-key

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/milan_ai

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Payment Gateways
KHALTI_SECRET_KEY=...
ESEWA_MERCHANT_ID=...

# Storage
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📚 API Documentation

- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`
- **OpenAPI Schema**: `/openapi.json`

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting
- Content moderation
- Fraud detection
- Image verification
- Data encryption at rest
- GDPR-compliant data handling

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4/Claude API
- FastAPI team for the amazing framework
- React team for the frontend library
- The Nepalese tech community for support


---

<p align="center">
  Made in Nepal
</p>
