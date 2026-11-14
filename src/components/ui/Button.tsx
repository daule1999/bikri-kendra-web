interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }[size];

  const variantStyles: React.CSSProperties = {
    primary:   { background: 'linear-gradient(135deg, var(--theme-accent), var(--theme-accent-dark))', color: 'white', border: 'none' },
    secondary: { background: 'transparent', color: 'var(--theme-text-secondary)', border: '1px solid var(--theme-border-strong)' },
    danger:    { background: 'var(--theme-danger)', color: 'white', border: 'none' },
    ghost:     { background: 'transparent', color: 'var(--theme-text-muted)', border: 'none' },
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      style={variantStyles}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-150
        hover:opacity-90 active:scale-[0.97]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses} ${className}
      `}
      {...props}
    >
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}