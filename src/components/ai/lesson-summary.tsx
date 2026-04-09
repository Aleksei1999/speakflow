'use client'

import { cn } from '@/lib/utils'

interface VocabularyItem {
  word: string
  translation: string
  example: string
}

interface LessonSummaryData {
  id: string
  summary_text: string
  vocabulary: VocabularyItem[]
  grammar_points: string[]
  homework: string | null
  strengths: string | null
  areas_to_improve: string | null
  created_at: string
  teacherName?: string
  lessonDate?: string
}

interface LessonSummaryProps {
  summary: LessonSummaryData
  className?: string
}

export function LessonSummary({ summary, className }: LessonSummaryProps) {
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/student/summaries/${summary.id}`
      : ''

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      // Можно подключить toast-уведомление через sonner
    } catch {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
  }

  return (
    <div
      className={cn(
        'mx-auto max-w-3xl space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950',
        'print:shadow-none print:border-none print:p-0',
        className
      )}
    >
      {/* Заголовок */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
            AI-отчёт по уроку
          </h2>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
            {summary.teacherName && (
              <span>Преподаватель: {summary.teacherName}</span>
            )}
            {summary.lessonDate && (
              <span>{summary.lessonDate}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title="Скопировать ссылку"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" />
            </svg>
            Поделиться
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title="Печать"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            Печать
          </button>
        </div>
      </div>

      {/* Общее резюме */}
      <Section title="Общее резюме" icon="summary">
        <p className="text-gray-700 leading-relaxed dark:text-gray-300">
          {summary.summary_text}
        </p>
      </Section>

      {/* Словарь */}
      {summary.vocabulary && summary.vocabulary.length > 0 && (
        <Section title="Словарь" icon="vocabulary">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Слово / Фраза
                  </th>
                  <th className="pb-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Перевод
                  </th>
                  <th className="pb-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                    Пример
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.vocabulary.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="py-2.5 pr-4 font-medium text-[#722F37] dark:text-[#d4737d]">
                      {item.word}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                      {item.translation}
                    </td>
                    <td className="py-2.5 text-gray-600 italic dark:text-gray-400">
                      {item.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Грамматика */}
      {summary.grammar_points && summary.grammar_points.length > 0 && (
        <Section title="Грамматика" icon="grammar">
          <ul className="space-y-2">
            {summary.grammar_points.map((point, index) => (
              <li
                key={index}
                className="flex gap-2 text-gray-700 dark:text-gray-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#722F37]" />
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Домашнее задание */}
      {summary.homework && (
        <Section title="Домашнее задание" icon="homework">
          <div className="rounded-lg border border-[#722F37]/20 bg-[#722F37]/5 p-4 dark:border-[#722F37]/30 dark:bg-[#722F37]/10">
            <p className="whitespace-pre-line text-gray-800 leading-relaxed dark:text-gray-200">
              {summary.homework}
            </p>
          </div>
        </Section>
      )}

      {/* Что получилось хорошо */}
      {summary.strengths && (
        <Section title="Что получилось хорошо" icon="strengths">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
            <p className="whitespace-pre-line text-green-800 leading-relaxed dark:text-green-300">
              {summary.strengths}
            </p>
          </div>
        </Section>
      )}

      {/* Над чем поработать */}
      {summary.areas_to_improve && (
        <Section title="Над чем поработать" icon="improve">
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
            <p className="whitespace-pre-line text-orange-800 leading-relaxed dark:text-orange-300">
              {summary.areas_to_improve}
            </p>
          </div>
        </Section>
      )}
    </div>
  )
}

// ---------- Section ----------

const SECTION_ICONS: Record<string, string> = {
  summary: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12',
  vocabulary: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  grammar: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z',
  homework: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z',
  strengths: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  improve: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  const iconPath = SECTION_ICONS[icon] || SECTION_ICONS.summary

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-50">
        <svg
          className="h-5 w-5 text-[#722F37] dark:text-[#d4737d]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
        {title}
      </h3>
      {children}
    </div>
  )
}
