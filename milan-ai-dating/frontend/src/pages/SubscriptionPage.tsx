import { useState, useEffect } from 'react'
import { Crown, Check, Sparkles, Zap, Eye } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import toast from 'react-hot-toast'

interface Plan {
  plan_code: string
  name_en: string
  monthly_price_npr: number
  features: Record<string, any>
}

export default function SubscriptionPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await api.get('/subscriptions/plans')
      setPlans(response.data)
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubscribe = async (planCode: string) => {
    try {
      const response = await api.post('/subscriptions/subscribe', {
        plan_code: planCode,
        payment_method: 'khalti',
        period: 'monthly'
      })
      
      if (response.data.payment_url) {
        window.location.href = response.data.payment_url
      }
    } catch (error) {
      toast.error('Failed to initiate subscription')
    }
  }

  const getPlanIcon = (planCode: string) => {
    switch (planCode) {
      case 'elite':
        return <Crown className="w-8 h-8" />
      case 'premium':
        return <Sparkles className="w-8 h-8" />
      case 'basic':
        return <Zap className="w-8 h-8" />
      default:
        return <Eye className="w-8 h-8" />
    }
  }

  const getPlanColor = (planCode: string) => {
    switch (planCode) {
      case 'elite':
        return 'from-yellow-400 to-orange-500'
      case 'premium':
        return 'from-purple-500 to-pink-500'
      case 'basic':
        return 'from-blue-400 to-cyan-500'
      default:
        return 'from-gray-400 to-gray-500'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Upgrade Your Experience
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Unlock premium features and find your perfect match faster with our AI-powered dating platform
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Plan</p>
            <h2 className="text-2xl font-bold capitalize">{user?.subscription_tier}</h2>
          </div>
          {user?.subscription_tier !== 'free' && (
            <button
              onClick={() => api.post('/subscriptions/cancel')}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-full hover:bg-red-50"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.plan_code}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
              user?.subscription_tier === plan.plan_code
                ? 'ring-2 ring-pink-500'
                : ''
            }`}
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${getPlanColor(plan.plan_code)} p-6 text-white`}>
              <div className="mb-4">{getPlanIcon(plan.plan_code)}</div>
              <h3 className="text-xl font-bold">{plan.name_en}</h3>
              <div className="mt-2">
                <span className="text-3xl font-bold">Rs. {plan.monthly_price_npr}</span>
                <span className="text-white/80">/month</span>
              </div>
            </div>

            {/* Features */}
            <div className="p-6">
              <ul className="space-y-3">
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-600">
                    {plan.features.daily_swipes === 999999
                      ? 'Unlimited swipes'
                      : `${plan.features.daily_swipes} swipes/day`}
                  </span>
                </li>
                <li className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-500" />
                  <span className="text-gray-600">
                    {plan.features.superlikes_per_day} superlikes/day
                  </span>
                </li>
                {plan.features.see_likes && (
                  <li className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">See who liked you</span>
                  </li>
                )}
                {plan.features.advanced_filters && (
                  <li className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">Advanced filters</span>
                  </li>
                )}
                {plan.features.ai_assistant && (
                  <li className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">AI conversation assistant</span>
                  </li>
                )}
                {plan.features.incognito_mode && (
                  <li className="flex items-center space-x-3">
                    <Check className="w-5 h-5 text-green-500" />
                    <span className="text-gray-600">Incognito mode</span>
                  </li>
                )}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleSubscribe(plan.plan_code)}
                disabled={user?.subscription_tier === plan.plan_code}
                className={`w-full mt-6 py-3 rounded-xl font-semibold transition-all ${
                  user?.subscription_tier === plan.plan_code
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'gradient-primary text-white hover:shadow-lg'
                }`}
              >
                {user?.subscription_tier === plan.plan_code
                  ? 'Current Plan'
                  : 'Subscribe'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      <div className="mt-12 bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Methods</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              K
            </div>
            <span>Khalti</span>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              e
            </div>
            <span>eSewa</span>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 border border-gray-200 rounded-lg">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              I
            </div>
            <span>IME Pay</span>
          </div>
        </div>
      </div>
    </div>
  )
}
