"use client"

import { useState } from "react"
import { ChevronDown, CheckCircle2, AlertCircle, BookOpen, PenLine, Lightbulb } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SummaryExpandableProps {
  id: string
  header: React.ReactNode
  summaryText: string
  vocabulary: any[]
  grammarPoints: any[]
  homework: string | null
  strengths: string | null
  areasToImprove: string | null
}

export function SummaryExpandable({
  id,
  header,
  summaryText,
  vocabulary,
  grammarPoints,
  homework,
  strengths,
  areasToImprove,
}: SummaryExpandableProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card
      className="cursor-pointer transition-all hover:ring-[#CC3A3A]/20 hover:ring-2"
      onClick={() => setExpanded((prev) => !prev)}
    >
      <CardContent className="flex flex-col gap-0">
        <div className="flex items-center gap-2">
          <div className="flex-1">{header}</div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </div>

        {expanded && (
          <div
            className="mt-4 flex flex-col gap-4 border-t pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Summary */}
            {summaryText && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BookOpen className="size-4 text-[#CC3A3A]" />
                  Резюме урока
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summaryText}
                </p>
              </div>
            )}

            {/* Vocabulary */}
            {vocabulary.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PenLine className="size-4 text-[#CC3A3A]" />
                  Словарь ({vocabulary.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {vocabulary.map((word: any, i: number) => {
                    const text =
                      typeof word === "string"
                        ? word
                        : word?.word ?? word?.term ?? ""
                    const translation = typeof word === "object" ? word?.translation ?? word?.meaning ?? "" : ""

                    return (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs"
                      >
                        {text}
                        {translation ? ` - ${translation}` : ""}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Grammar */}
            {grammarPoints.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="size-4 text-[#CC3A3A]" />
                  Грамматика
                </div>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                  {grammarPoints.map((point: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#CC3A3A]" />
                      {typeof point === "string" ? point : point?.topic ?? point?.point ?? ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Homework */}
            {homework && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PenLine className="size-4 text-[#CC3A3A]" />
                  Домашнее задание
                </div>
                <p className="text-sm text-muted-foreground">{homework}</p>
              </div>
            )}

            {/* Strengths */}
            {strengths && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="size-4 text-green-500" />
                  Сильные стороны
                </div>
                <p className="text-sm text-muted-foreground">{strengths}</p>
              </div>
            )}

            {/* Areas to improve */}
            {areasToImprove && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertCircle className="size-4 text-orange-500" />
                  Области для улучшения
                </div>
                <p className="text-sm text-muted-foreground">
                  {areasToImprove}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
