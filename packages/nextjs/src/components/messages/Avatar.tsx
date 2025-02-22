interface AvatarProps {
  name: string
  imageUrl?: string
  size?: "sm" | "md" | "lg"
}

export function Avatar({ name, imageUrl, size = "md" }: AvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  }

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0`}>
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
    </div>
  )
}

