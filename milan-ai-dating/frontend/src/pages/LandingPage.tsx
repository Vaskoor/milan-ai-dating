import { Link } from 'react-router-dom'
import { Heart, Sparkles, Shield, MessageCircle, Star, Check } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Matching',
    description: 'Our advanced AI analyzes your personality and preferences to find your most compatible matches.',
  },
  {
    icon: Shield,
    title: 'Safe & Secure',
    description: 'Multi-layered safety systems including photo verification, fraud detection, and content moderation.',
  },
  {
    icon: MessageCircle,
    title: 'Smart Conversations',
    description: 'AI conversation coach helps you break the ice and keep conversations engaging.',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: 0,
    period: '',
    features: ['50 swipes per day', 'Basic matching', 'Chat with matches', 'Profile creation'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Basic',
    price: 499,
    period: '/month',
    features: ['100 swipes per day', 'See who liked you', 'Advanced filters', 'Unlimited likes'],
    cta: 'Upgrade to Basic',
    highlighted: false,
  },
  {
    name: 'Premium',
    price: 999,
    period: '/month',
    features: ['Unlimited swipes', 'AI conversation assistant', 'Read receipts', 'Profile boost'],
    cta: 'Go Premium',
    highlighted: true,
  },
  {
    name: 'Elite',
    price: 1999,
    period: '/month',
    features: ['Everything in Premium', 'Incognito mode', 'Priority support', 'Exclusive matches'],
    cta: 'Become Elite',
    highlighted: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-romantic opacity-10" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-pink-100 rounded-full text-pink-700 text-sm font-medium mb-8">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Dating for Nepal</span>
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6"
            >
              Find Your{' '}
              <span className="bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                Perfect Match
              </span>
              <br />
              with AI
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto"
            >
              Milan AI uses advanced artificial intelligence to understand your personality,
              preferences, and values to connect you with your most compatible partner.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <Link
                to="/register"
                className="px-8 py-4 gradient-primary text-white rounded-full font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all"
              >
                Get Started Free
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-full font-semibold text-lg hover:border-pink-300 hover:text-pink-600 transition-all"
              >
                Sign In
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Choose Milan AI?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience the future of dating with our cutting-edge AI technology
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that works best for you
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`rounded-2xl p-6 ${
                  plan.highlighted
                    ? 'gradient-primary text-white scale-105 shadow-xl'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <h3 className={`text-lg font-semibold mb-2 ${
                  plan.highlighted ? 'text-white' : 'text-gray-900'
                }`}>
                  {plan.name}
                </h3>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${
                    plan.highlighted ? 'text-white' : 'text-gray-900'
                  }`}>
                    Rs. {plan.price}
                  </span>
                  <span className={plan.highlighted ? 'text-pink-100' : 'text-gray-500'}>
                    {plan.period}
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center space-x-2">
                      <Check className={`w-5 h-5 ${
                        plan.highlighted ? 'text-pink-200' : 'text-green-500'
                      }`} />
                      <span className={plan.highlighted ? 'text-pink-50' : 'text-gray-600'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={`block text-center py-3 rounded-full font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-white text-pink-600 hover:bg-pink-50'
                      : 'gradient-primary text-white hover:shadow-lg'
                  }`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Find Your Match?
          </h2>
          <p className="text-lg text-gray-400 mb-10">
            Join thousands of singles in Nepal who have found love through Milan AI
          </p>
          <Link
            to="/register"
            className="inline-flex items-center space-x-2 px-8 py-4 gradient-primary text-white rounded-full font-semibold text-lg hover:shadow-lg hover:scale-105 transition-all"
          >
            <Heart className="w-5 h-5" />
            <span>Start Your Journey</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                Milan AI
              </span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2024 Milan AI. All rights reserved. Made with love in Nepal.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
