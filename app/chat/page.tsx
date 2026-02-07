'use client'
import { useEffect, useState } from 'react'
import FriendList from '../../components/FriendList'
import ChatWindow from '../../components/ChatWindow'
import LockOverlay from '../../components/LockOverlay'

export default function ChatPage() {
  const [activeFriend, setActiveFriend] = useState<any>(null)

  return (
    <div className="h-screen flex">
      <aside className="chat-sidebar bg-white border-r">
        <FriendList onSelect={(f: any) => setActiveFriend(f)} />
      </aside>
      <main className="flex-1 bg-neutral-50">
        <ChatWindow activeFriend={activeFriend} />
        <LockOverlay />
      </main>
    </div>
  )
}
