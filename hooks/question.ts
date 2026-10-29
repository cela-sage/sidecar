export type Answers = Record<string, string>

export type Heard = Answers | 'idle' | 'down'

export interface QuestionPort {
  poll: () => Promise<Heard>
  rest: () => Promise<void>
  isGone: () => boolean
}

export type Raced<T> = { from: 'dialog'; result: T } | { from: 'door'; answers: Answers } | { from: 'gone' }

const answersOf = (text: string): Answers | undefined => {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) return undefined
    const pairs = Object.entries(parsed).filter((pair): pair is [string, string] => typeof pair[1] === 'string')
    return pairs.length ? Object.fromEntries(pairs) : undefined
  } catch {
    return undefined
  }
}

const hear = async ({ poll, rest, isGone }: QuestionPort): Promise<Answers | undefined> => {
  while (!isGone()) {
    const heard = await poll()
    if (typeof heard === 'object') return heard
    if (heard === 'down') await rest()
  }
}

// The terminal stays a place to answer: whichever of the dialog and the door answers first settles the call.
const race = <T>(dialog: Promise<T>, port: QuestionPort): Promise<Raced<T>> => {
  let isSettled = false
  const fromDialog = dialog.then((result): Raced<T> => {
    isSettled = true
    return { from: 'dialog', result }
  })
  const fromDoor = async (): Promise<Raced<T>> => {
    const answers = await hear({ ...port, isGone: () => isSettled || port.isGone() })
    if (answers) return { from: 'door', answers }
    return port.isGone() ? { from: 'gone' } : fromDialog
  }
  return Promise.race([fromDialog, fromDoor()])
}

export const Question = { answersOf, hear, race }
