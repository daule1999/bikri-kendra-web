export default function UserDropdown() {
  return (
    <div className="relative">
      <button className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100">
        <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
          U
        </div>
        <span>User</span>
      </button>
    </div>
  )
}