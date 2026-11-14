interface UserAvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
}

export default function UserAvatar({ name, size = 'md' }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  }
  
  return (
    <div className={`${sizeClasses[size]} bg-gray-500 text-white rounded-full flex items-center justify-center font-bold`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}