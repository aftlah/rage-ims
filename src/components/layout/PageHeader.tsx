import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('page-header', className)}>
      <div className="min-w-0 flex-1">
        <h2 className="page-title">{title}</h2>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {children ? (
        <div className="page-header-actions">{children}</div>
      ) : null}
    </div>
  )
}

export function PageStack({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('page-stack flex flex-col', className)}>{children}</div>
  )
}
