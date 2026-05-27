import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services'
import toast from 'react-hot-toast'
import { Eye, EyeOff, FileText } from 'lucide-react'
import { getErrorMessage } from '../../utils'

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>
        </div>
        <div className="card">{children}</div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [showPass, setShowPass] = useState(false)
  const [needs2FA, setNeeds2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [email, setEmail] = useState('')

  const onSubmit = async (data) => {
    try {
      const { data: res } = await authService.login(data)
      if (res.requires_2fa) {
        setNeeds2FA(true)
        setTempToken(res.temp_token)
        setEmail(data.email)
      } else {
        login(res.access_token, res.user)
        navigate('/dashboard')
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const on2FA = async (data) => {
    try {
      const { data: res } = await authService.verify2FA({ email, totp_code: data.code, temp_token: tempToken })
      login(res.access_token, res.user)
      navigate('/dashboard')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (needs2FA) {
    return (
      <AuthCard title="Verificación en dos pasos" subtitle="Ingresa el código de tu app autenticadora">
        <form onSubmit={handleSubmit(on2FA)} className="space-y-4">
          <div>
            <label className="label">Código de 6 dígitos</label>
            <input {...register('code', { required: true })} className="input text-center text-2xl tracking-widest" maxLength={6} placeholder="000000" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verificando...' : 'Verificar'}
          </button>
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Iniciar sesión" subtitle="Sistema de Gestión de Reincorporación y Licencia">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Correo electrónico</label>
          <input {...register('email', { required: 'Requerido' })} type="email" className="input" placeholder="correo@ejemplo.cl" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Contraseña</label>
          <div className="relative">
            <input
              {...register('password', { required: 'Requerido' })}
              type={showPass ? 'text' : 'password'}
              className="input pr-10"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-2.5 text-gray-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">¿Olvidaste tu contraseña?</Link>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary-600 hover:underline font-medium">Regístrate</Link>
        </p>
      </form>
    </AuthCard>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm()
  const [showPass, setShowPass] = useState(false)

  const onSubmit = async (data) => {
    try {
      await authService.register(data)
      toast.success('Cuenta creada. Revisa tu correo para verificar.')
      navigate('/login')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <AuthCard title="Crear cuenta" subtitle="Registro de estudiante">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombres *</label>
            <input {...register('nombres', { required: 'Requerido' })} className="input" />
            {errors.nombres && <p className="text-red-500 text-xs mt-1">{errors.nombres.message}</p>}
          </div>
          <div>
            <label className="label">Apellidos *</label>
            <input {...register('apellidos', { required: 'Requerido' })} className="input" />
            {errors.apellidos && <p className="text-red-500 text-xs mt-1">{errors.apellidos.message}</p>}
          </div>
        </div>
        <div>
          <label className="label">Correo electrónico *</label>
          <input {...register('email', { required: 'Requerido' })} type="email" className="input" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Código estudiante *</label>
            <input {...register('codigo_estudiante', { required: 'Requerido' })} className="input" />
          </div>
          <div>
            <label className="label">Año matrícula *</label>
            <input {...register('anno_matricula', { required: 'Requerido' })} className="input" placeholder="2024" />
          </div>
        </div>
        <div>
          <label className="label">Carrera *</label>
          <input {...register('carrera', { required: 'Requerido' })} className="input" placeholder="Educación Inicial" />
        </div>
        <div>
          <label className="label">Ciclo actual *</label>
          <input {...register('ciclo_actual', { required: 'Requerido' })} className="input" placeholder="2024-1" />
        </div>
        <div>
          <label className="label">Contraseña *</label>
          <div className="relative">
            <input {...register('password', { required: 'Requerido', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} type={showPass ? 'text' : 'password'} className="input pr-10" />
            <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-2.5 text-gray-400">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="label">Confirmar contraseña *</label>
          <input
            {...register('confirm_password', {
              required: 'Requerido',
              validate: v => v === watch('password') || 'Las contraseñas no coinciden',
            })}
            type="password" className="input"
          />
          {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Crear cuenta'}
        </button>
        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">Inicia sesión</Link>
        </p>
      </form>
    </AuthCard>
  )
}

export function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()
  const [sent, setSent] = useState(false)

  const onSubmit = async (data) => {
    try {
      await authService.forgotPassword(data.email)
      setSent(true)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un enlace a tu correo">
      {sent ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">Si el correo existe, recibirás un enlace de recuperación.</p>
          <Link to="/login" className="mt-4 inline-block text-primary-600 hover:underline text-sm">Volver al login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Correo electrónico</label>
            <input {...register('email', { required: true })} type="email" className="input" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
          </button>
          <div className="text-center">
            <Link to="/login" className="text-sm text-primary-600 hover:underline">Volver al login</Link>
          </div>
        </form>
      )}
    </AuthCard>
  )
}
