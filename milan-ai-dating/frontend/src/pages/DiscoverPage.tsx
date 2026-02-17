import { useState, useEffect } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { Heart, X, Star, MapPin, Info, Loader2 } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

interface Profile {
  id: string
  user_id: string
  first_name: string
  age?: number
  profile_photo_url?: string
  city?: string
  bio?: string
  interests: string[]
  verification_badge_level: number
}

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)

  useEffect(() => {
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    try {
      const response = await api.get('/matches/discover')
      setProfiles(response.data)
    } catch (error) {
      toast.error('Failed to load profiles')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwipe = async (action: 'like' | 'dislike' | 'superlike') => {
    if (currentIndex >= profiles.length) return

    const profile = profiles[currentIndex]
    setDirection(action === 'like' || action === 'superlike' ? 'right' : 'left')

    try {
      const response = await api.post('/matches/swipe', {
        swiped_id: profile.user_id,
        action,
      })

      if (response.data.is_match) {
        toast.success(`It's a match with ${profile.first_name}! 🎉`)
      }
    } catch (error) {
      toast.error('Failed to process swipe')
    }

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setDirection(null)
    }, 300)
  }

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100
    if (info.offset.x > threshold) {
      handleSwipe('like')
    } else if (info.offset.x < -threshold) {
      handleSwipe('dislike')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    )
  }

  if (currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center">
        <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mb-6">
          <Heart className="w-12 h-12 text-pink-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">No more profiles</h2>
        <p className="text-gray-600 mb-6">Check back later for more matches!</p>
        <button
          onClick={() => {
            setCurrentIndex(0)
            fetchProfiles()
          }}
          className="px-6 py-3 gradient-primary text-white rounded-full font-semibold"
        >
          Refresh
        </button>
      </div>
    )
  }

  const currentProfile = profiles[currentIndex]

  return (
    <div className="max-w-md mx-auto">
      {/* Card Stack */}
      <div className="relative h-[500px] mb-6">
        <AnimatePresence>
          {currentIndex < profiles.length && (
            <motion.div
              key={currentProfile.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{
                x: direction === 'right' ? 300 : -300,
                opacity: 0,
                rotate: direction === 'right' ? 30 : -30,
              }}
              transition={{ duration: 0.3 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 bg-white rounded-3xl shadow-xl overflow-hidden cursor-grab active:cursor-grabbing"
            >
              {/* Photo */}
              <div className="relative h-3/4">
                <img
                  src={currentProfile.profile_photo_url || '/default-avatar.png'}
                  alt={currentProfile.first_name}
                  className="w-full h-full object-cover"
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                
                {/* Verification badge */}
                {currentProfile.verification_badge_level >= 2 && (
                  <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Verified</span>
                  </div>
                )}

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-3xl font-bold">
                      {currentProfile.first_name}, {currentProfile.age}
                    </h2>
                  </div>
                  
                  {currentProfile.city && (
                    <div className="flex items-center space-x-1 text-white/80 mb-3">
                      <MapPin className="w-4 h-4" />
                      <span>{currentProfile.city}</span>
                    </div>
                  )}

                  {currentProfile.bio && (
                    <p className="text-white/90 line-clamp-2">{currentProfile.bio}</p>
                  )}

                  {/* Interests */}
                  {currentProfile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentProfile.interests.slice(0, 3).map((interest) => (
                        <span
                          key={interest}
                          className="px-3 py-1 bg-white/20 rounded-full text-sm"
                        >
                          {interest}
                        </span>
                      ))}
                      {currentProfile.interests.length > 3 && (
                        <span className="px-3 py-1 bg-white/20 rounded-full text-sm">
                          +{currentProfile.interests.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions hint */}
              <div className="h-1/4 flex items-center justify-center space-x-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                    <X className="w-6 h-6 text-red-500" />
                  </div>
                  <span className="text-sm text-gray-500">Pass</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                    <Star className="w-6 h-6 text-blue-500" />
                  </div>
                  <span className="text-sm text-gray-500">Super</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                    <Heart className="w-6 h-6 text-green-500" />
                  </div>
                  <span className="text-sm text-gray-500">Like</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center space-x-6">
        <button
          onClick={() => handleSwipe('dislike')}
          className="w-16 h-16 bg-white border-2 border-red-200 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shadow-lg"
        >
          <X className="w-8 h-8 text-red-500" />
        </button>

        <button
          onClick={() => handleSwipe('superlike')}
          className="w-14 h-14 bg-white border-2 border-blue-200 rounded-full flex items-center justify-center hover:bg-blue-50 transition-colors shadow-lg"
        >
          <Star className="w-6 h-6 text-blue-500" />
        </button>

        <button
          onClick={() => handleSwipe('like')}
          className="w-16 h-16 bg-white border-2 border-green-200 rounded-full flex items-center justify-center hover:bg-green-50 transition-colors shadow-lg"
        >
          <Heart className="w-8 h-8 text-green-500" />
        </button>
      </div>

      <p className="text-center text-gray-500 text-sm mt-4">
        Swipe right to like, left to pass
      </p>
    </div>
  )
}
