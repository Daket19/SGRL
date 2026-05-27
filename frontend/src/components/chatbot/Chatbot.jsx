import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react'
import { chatbotService } from '../../services'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Chatbot() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy el asistente del SGRL. Puedo ayudarte con información sobre licencias, reincorporaciones, requisitos y más. ¿En qué te puedo ayudar?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  if (!user) return null

  const send = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const historial = messages.slice(-10)
      const { data } = await chatbotService.enviar(msg, historial)
      setMessages(prev => [...prev, { role: 'assistant', content: data.respuesta }])
    } catch {
      toast.error('Error al enviar mensaje')
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Burbuja flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Ventana */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-600 rounded-t-2xl">
            <Bot className="w-6 h-6 text-white" />
            <div>
              <p className="text-sm font-semibold text-white">Asistente SGRL</p>
              <p className="text-xs text-primary-100">Disponible 24/7</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-gray-100 flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu consulta..."
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
