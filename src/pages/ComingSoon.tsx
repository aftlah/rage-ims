import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ComingSoonProps = {
  title: string
}

export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <Card className="max-w-md border-border/60 bg-card/80">
        <CardHeader>
          <CardDescription className="text-xs tracking-[0.2em] uppercase">
            Modul
          </CardDescription>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}
