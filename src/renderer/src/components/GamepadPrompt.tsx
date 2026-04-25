import type { ReactNode } from 'react'

export type GamepadPromptKey =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'dpad-up'
  | 'dpad-down'
  | 'dpad-left'
  | 'dpad-right'

interface GamepadPromptProps {
  prompt: GamepadPromptKey
}

interface GamepadHintItemProps {
  prompt: GamepadPromptKey | readonly GamepadPromptKey[]
  children: ReactNode
}

const DPAD_LABELS: Record<Extract<GamepadPromptKey, `dpad-${string}`>, string> = {
  'dpad-up': '↑',
  'dpad-down': '↓',
  'dpad-left': '←',
  'dpad-right': '→'
}

const SHOULDER_LABELS: Record<'lb' | 'rb' | 'lt' | 'rt', string> = {
  lb: 'LB',
  rb: 'RB',
  lt: 'LT',
  rt: 'RT'
}

export function GamepadPrompt({ prompt }: GamepadPromptProps): JSX.Element {
  if (prompt === 'a' || prompt === 'b' || prompt === 'x' || prompt === 'y') {
    return (
      <span className={`gamepad-prompt gamepad-prompt--face gamepad-prompt--${prompt}`}>
        {prompt.toUpperCase()}
      </span>
    )
  }

  if (prompt === 'lb' || prompt === 'rb' || prompt === 'lt' || prompt === 'rt') {
    return (
      <span className={`gamepad-prompt gamepad-prompt--shoulder gamepad-prompt--${prompt}`}>
        {SHOULDER_LABELS[prompt]}
      </span>
    )
  }

  return (
    <span className="gamepad-prompt gamepad-prompt--dpad">
      {DPAD_LABELS[prompt]}
    </span>
  )
}

export function GamepadHintItem({ prompt, children }: GamepadHintItemProps): JSX.Element {
  const prompts = Array.isArray(prompt) ? prompt : [prompt]

  return (
    <span className="gamepad-hint-item">
      <span className="gamepad-hint-item__prompts">
        {prompts.map((key) => (
          <GamepadPrompt key={key} prompt={key} />
        ))}
      </span>
      <span>{children}</span>
    </span>
  )
}
