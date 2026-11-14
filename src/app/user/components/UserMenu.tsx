export default function UserMenu() {
  return (
    <nav className="space-y-2">
      <a href="/user/profile" className="block p-2 hover:bg-gray-100 rounded">Profile</a>
      <a href="/user/security" className="block p-2 hover:bg-gray-100 rounded">Security</a>
      <a href="/user/preferences" className="block p-2 hover:bg-gray-100 rounded">Preferences</a>
    </nav>
  )
}