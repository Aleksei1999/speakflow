// Ambient declaration used while src/components/onboarding/level-quiz.tsx
// is being built by another agent. Delete this file once the real module
// exists and exports the same types.
declare module '@/components/onboarding/level-quiz' {
  export interface QuizResult {
    id?: string
    level: string
    levelName: string
    xp: number
    percent: number
    correctCount: number
    totalQuestions: number
    [extraKey: string]: unknown
  }

  export interface LevelQuizProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onComplete?: (result: QuizResult) => void
  }

  export const LevelQuiz: React.ComponentType<LevelQuizProps>
}
