import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export function HeartIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export function CompassIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}

export function TwitchGlyphIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props} viewBox="0 0 24 24">
      <path d="M5 3h14v10l-4 4h-4l-3 3v-3H5z" />
      <path d="M10 8v4" />
      <path d="M14 8v4" />
    </svg>
  )
}

export function ChartIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <path d="M4 19h16" />
      <path d="M7 16V9" />
      <path d="M12 16V5" />
      <path d="M17 16v-7" />
    </svg>
  )
}

export function UserIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function PlayIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

export function PauseIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export function StopIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props} fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function EyeIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function GamepadIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M6 12h4" />
      <path d="M8 10v4" />
      <circle cx="15" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ClapperboardIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} {...props}>
      <path d="M4 11H20V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11z" />
      <path d="M4 11V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v4" />
      <path d="M4 9l4-3 4 3 4-3" />
    </svg>
  )
}
