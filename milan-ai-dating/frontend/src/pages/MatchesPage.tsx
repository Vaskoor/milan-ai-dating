import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Loader2 } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

interface Match {
  id: string
  other_user: {
    id: string
    first_name: string
    profile_photo_url?: string
    age?: number
  }
  compatibility_score?: number
  message_count: number
  last_message_at?: string
  created_at: string
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      const response = await api.get('/matches/my-matches')
      setMatches(response.data)
    } catch (error) {
      toast.error('Failed to load matches')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-12 h-12 text-pink-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No matches yet</h2>
        <p className="text-gray-600 mb-6">Keep swiping to find your perfect match!</p>
        <Link
          to="/discover"
          className="px-6 py-3 gradient-primary text-white rounded-full font-semibold"
        >
          Start Swiping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Matches</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/chat`}
            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="relative">
              <img
                src={match.other_user.profile_photo_url || '/default-avatar.png'}
                alt={match.other_user.first_name}
                className="w-full h-48 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <h3 className="text-white font-bold text-lg">
                  {match.other_user.first_name}
                  {match.other_user.age && `, ${match.other_user.age}`}
                </h3>
              </div>
            </div>

            <div className="p-4">
              {match.compatibility_score && (
                <div className="flex items-center space-x-2 mb-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="gradient-primary h-2 rounded-full"
                      style={{ width: `${match.compatibility_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-pink-600">
                    {Math.round(match.compatibility_score)}%
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1 text-gray-500">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{match.message_count} messages</span>
                </div>
                <button className="px-4 py-2 gradient-primary text-white rounded-full text-sm font-medium">
                  Message
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
