import wordDashLogo from '../../assets/word-dash-logo.svg'

type BrandLogoProps = {
    className?: string
}

export function BrandLogo({ className }: BrandLogoProps) {
    return <img src={wordDashLogo} alt="Word Dash" className={className} />
}
