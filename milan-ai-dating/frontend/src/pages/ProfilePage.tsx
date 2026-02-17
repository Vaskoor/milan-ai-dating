import { useState, useEffect } from 'react'
import { Camera, MapPin, Briefcase, GraduationCap, Heart, Edit2, Check } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import toast from 'react-hot-toast'

interface Profile {
  id: string
  first_name: string
  last_name?: string
  bio?: string
  city?: string
  occupation?: string
  education?: string
  profile_photo_url?: string
  photo_count: number
  profile_completion_score: number
  interests: { id: string; interest_name: string }[]
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<Profile>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile/me')
      setProfile(response.data)
      setEditData(response.data)
    } catch (error) {
      toast.error('Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      await api.put('/users/profile/me', editData)
      setProfile({ ...profile, ...editData } as Profile)
      setIsEditing(false)
      toast.success('Profile updated')
    } catch (error) {
      toast.error('Failed to update profile')
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="relative h-48 gradient-romantic">
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
            <div className="relative">
              <img
                src={profile.profile_photo_url || '/default-avatar.png'}
                alt={profile.first_name}
                className="w-32 h-32 rounded-full border-4 border-white object-cover"
              />
              <button className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center">
                <Camera className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-20 pb-6 px-6 text-center">
          {isEditing ? (
            <div className="space-y-4">
              <input
                type="text"
                value={editData.first_name || ''}
                onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                className="text-2xl font-bold text-center border-b-2 border-pink-500 focus:outline-none"
              />
              <textarea
                value={editData.bio || ''}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder="Add a bio..."
                className="w-full p-3 border border-gray-300 rounded-xl resize-none"
                rows={3}
              />
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => {
                    setEditData(profile)
                    setIsEditing(false)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-full"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 gradient-primary text-white rounded-full flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {profile.first_name}
              </h1>
              {profile.bio && (
                <p className="text-gray-600 mb-4">{profile.bio}</p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-full text-sm hover:bg-gray-50"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
          <div className="text-2xl font-bold text-pink-600">{profile.photo_count}</div>
          <div className="text-sm text-gray-500">Photos</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
          <div className="text-2xl font-bold text-purple-600">
            {profile.profile_completion_score}%
          </div>
          <div className="text-sm text-gray-500">Complete</div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">
            {profile.interests.length}
          </div>
          <div className="text-sm text-gray-500">Interests</div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">About</h2>
        
        <div className="space-y-4">
          {profile.city && (
            <div className="flex items-center space-x-3 text-gray-600">
              <MapPin className="w-5 h-5" />
              <span>Lives in {profile.city}</span>
            </div>
          )}
          
          {profile.occupation && (
            <div className="flex items-center space-x-3 text-gray-600">
              <Briefcase className="w-5 h-5" />
              <span>{profile.occupation}</span>
            </div>
          )}
          
          {profile.education && (
            <div className="flex items-center space-x-3 text-gray-600">
              <GraduationCap className="w-5 h-5" />
              <span>{profile.education}</span>
            </div>
          )}
        </div>
      </div>

      {/* Interests */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Interests</h2>
        
        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span
              key={interest.id}
              className="px-4 py-2 bg-pink-100 text-pink-700 rounded-full text-sm font-medium"
            >
              {interest.interest_name}
            </span>
          ))}
          <button className="px-4 py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-full text-sm hover:border-pink-300 hover:text-pink-600">
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}
