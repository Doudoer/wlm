'use client'
import ProfileForm from '../../components/ProfileForm'

export default function ProfilePage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Configuración de perfil</h2>
        <ProfileForm />
      </div>
    </div>
  )
}
