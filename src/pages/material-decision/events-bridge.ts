/** The route registers synchronous handlers before rendering, without loading its data on other pages. */
interface MaterialDecisionHandlers {
  click: (target: HTMLElement) => boolean
  input: (target: HTMLElement) => boolean
  change: (target: HTMLElement) => boolean
  key: (event: KeyboardEvent) => boolean
}

let handlers: MaterialDecisionHandlers | undefined

export function connectMaterialDecisionHandlers(value: MaterialDecisionHandlers): void {
  handlers = value
}

export function dispatchMaterialDecisionClick(target: HTMLElement): boolean {
  return handlers?.click(target) ?? false
}

export function dispatchMaterialDecisionInput(target: HTMLElement): boolean {
  return handlers?.input(target) ?? false
}

export function dispatchMaterialDecisionChange(target: HTMLElement): boolean {
  return handlers?.change(target) ?? false
}

export function dispatchMaterialDecisionKey(event: KeyboardEvent): boolean {
  return handlers?.key(event) ?? false
}
