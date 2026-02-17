import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Loader2, Sparkles } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

interface Conversation {
  id: string
  other_user: {
    id: string
    first_name: string
    profile_photo_url?: string
  }
  unread_count: number
  last_message?: {
    content: string
    created_at: string
  }
}

interface Message {
  id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export default function ChatPage() {
  const { conversationId } = useParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find((c) => c.id === conversationId)
      if (conv) {
        setActiveConversation(conv)
        fetchMessages(conversationId)
      }
    }
  }, [conversationId, conversations])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchConversations = async () => {
    try {
      const response = await api.get('/chat/conversations')
      setConversations(response.data)
    } catch (error) {
      toast.error('Failed to load conversations')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMessages = async (convId: string) => {
    try {
      const response = await api.get(`/chat/conversations/${convId}/messages`)
      setMessages(response.data)
    } catch (error) {
      toast.error('Failed to load messages')
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !activeConversation) return

    try {
      const response = await api.post(
        `/chat/conversations/${activeConversation.id}/messages`,
        { content: newMessage, content_type: 'text' }
      )
      setMessages([...messages, response.data])
      setNewMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getAISuggestions = async () => {
    if (!activeConversation) return
    
    try {
      const response = await api.post('/chat/ai-suggestion', {
        conversation_id: activeConversation.id,
        tone: 'friendly'
      })
      toast.success('AI suggestions generated!')
      // Show suggestions in UI
    } catch (error) {
      toast.error('Premium feature required')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Messages</h2>
        </div>
        
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setActiveConversation(conv)
                fetchMessages(conv.id)
              }}
              className={`w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${
                activeConversation?.id === conv.id ? 'bg-pink-50' : ''
              }`}
            >
              <img
                src={conv.other_user.profile_photo_url || '/default-avatar.png'}
                alt={conv.other_user.first_name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-gray-900">
                  {conv.other_user.first_name}
                </h3>
                {conv.last_message && (
                  <p className="text-sm text-gray-500 truncate">
                    {conv.last_message.content}
                  </p>
                )}
              </div>
              {conv.unread_count > 0 && (
                <span className="w-5 h-5 gradient-primary rounded-full text-white text-xs flex items-center justify-center">
                  {conv.unread_count}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={activeConversation.other_user.profile_photo_url || '/default-avatar.png'}
                  alt={activeConversation.other_user.first_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <h3 className="font-semibold text-gray-900">
                  {activeConversation.other_user.first_name}
                </h3>
              </div>
              <button
                onClick={getAISuggestions}
                className="flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>AI Assist</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender_id === activeConversation.other_user.id
                      ? 'justify-start'
                      : 'justify-end'
                  }`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      message.sender_id === activeConversation.other_user.id
                        ? 'bg-gray-100 text-gray-900'
                        : 'gradient-primary text-white'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 gradient-primary text-white rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  )
}
