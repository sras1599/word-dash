import {
    Briefcase,
    Check,
    CircleHelp,
    DoorOpen,
    Layers,
    Minus,
    Plus,
    Settings,
    SlidersHorizontal,
    Timer,
    User,
    Users,
    type LucideIcon,
} from 'lucide-react'

type IconName =
    | 'tune'
    | 'timer'
    | 'minus'
    | 'plus'
    | 'check'
    | 'door'
    | 'group'
    | 'bag'
    | 'person'
    | 'help'
    | 'settings'
    | 'cards'

type IconProps = {
    name: IconName
    className?: string
}

const ICONS: Record<IconName, LucideIcon> = {
    tune: SlidersHorizontal,
    timer: Timer,
    minus: Minus,
    plus: Plus,
    check: Check,
    door: DoorOpen,
    group: Users,
    bag: Briefcase,
    person: User,
    help: CircleHelp,
    settings: Settings,
    cards: Layers,
}

export function Icon({ name, className }: IconProps) {
    const LucideIcon = ICONS[name]

    return <LucideIcon aria-hidden="true" className={className} />
}
