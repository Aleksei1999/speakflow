"use client"

import { useCallback, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Filter, X, Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Star } from "lucide-react"

// ---- Constants ----

const SPECIALIZATIONS = [
  { value: "general", label: "General English" },
  { value: "business", label: "Business English" },
  { value: "ielts", label: "IELTS" },
  { value: "toefl", label: "TOEFL" },
  { value: "kids", label: "Kids" },
  { value: "conversation", label: "Conversation" },
  { value: "grammar", label: "Grammar" },
  { value: "pronunciation", label: "Pronunciation" },
] as const

const LANGUAGES = [
  { value: "russian", label: "Русский" },
  { value: "english", label: "Английский" },
] as const

const SORT_OPTIONS = [
  { value: "rating", label: "По рейтингу" },
  { value: "price_asc", label: "По цене ↑" },
  { value: "price_desc", label: "По цене ↓" },
  { value: "experience", label: "По опыту" },
] as const

// ---- Types ----

export interface FilterValues {
  search: string
  specializations: string[]
  priceMin: string
  priceMax: string
  minRating: string
  languages: string[]
  sort: string
  page: string
}

function parseFiltersFromParams(params: URLSearchParams): FilterValues {
  return {
    search: params.get("search") || "",
    specializations: params.get("spec")?.split(",").filter(Boolean) || [],
    priceMin: params.get("price_min") || "",
    priceMax: params.get("price_max") || "",
    minRating: params.get("min_rating") || "",
    languages: params.get("lang")?.split(",").filter(Boolean) || [],
    sort: params.get("sort") || "rating",
    page: params.get("page") || "1",
  }
}

function filtersToParams(filters: FilterValues): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set("search", filters.search)
  if (filters.specializations.length)
    params.set("spec", filters.specializations.join(","))
  if (filters.priceMin) params.set("price_min", filters.priceMin)
  if (filters.priceMax) params.set("price_max", filters.priceMax)
  if (filters.minRating) params.set("min_rating", filters.minRating)
  if (filters.languages.length) params.set("lang", filters.languages.join(","))
  if (filters.sort && filters.sort !== "rating") params.set("sort", filters.sort)
  // Reset page on filter change
  return params
}

// ---- Search Bar ----

export function TeacherSearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const currentSearch = searchParams.get("search") || ""

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set("search", value)
      } else {
        params.delete("search")
      }
      params.delete("page")
      startTransition(() => {
        router.push(`/teachers?${params.toString()}`, { scroll: false })
      })
    },
    [router, searchParams, startTransition]
  )

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Поиск по имени преподавателя..."
        defaultValue={currentSearch}
        onChange={(e) => {
          const target = e.target as HTMLInputElement
          // Debounce
          const timeout = setTimeout(() => handleSearch(target.value), 300)
          return () => clearTimeout(timeout)
        }}
        className="h-10 pl-9 pr-4"
        aria-label="Поиск преподавателя по имени"
      />
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  )
}

// ---- Sort Select ----

export function TeacherSortSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const currentSort = searchParams.get("sort") || "rating"

  return (
    <Select
      value={currentSort}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== "rating") {
          params.set("sort", value)
        } else {
          params.delete("sort")
        }
        params.delete("page")
        startTransition(() => {
          router.push(`/teachers?${params.toString()}`, { scroll: false })
        })
      }}
    >
      <SelectTrigger className="w-[180px]" aria-label="Сортировка">
        <SelectValue placeholder="Сортировка" />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ---- Filter Controls (shared between desktop sidebar and mobile sheet) ----

function FilterControls({
  filters,
  onChange,
}: {
  filters: FilterValues
  onChange: (filters: FilterValues) => void
}) {
  const toggleSpec = (spec: string) => {
    const next = filters.specializations.includes(spec)
      ? filters.specializations.filter((s) => s !== spec)
      : [...filters.specializations, spec]
    onChange({ ...filters, specializations: next })
  }

  const toggleLang = (lang: string) => {
    const next = filters.languages.includes(lang)
      ? filters.languages.filter((l) => l !== lang)
      : [...filters.languages, lang]
    onChange({ ...filters, languages: next })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Specializations */}
      <div>
        <Label className="text-sm font-semibold mb-3">Специализация</Label>
        <div className="mt-2 flex flex-col gap-2">
          {SPECIALIZATIONS.map((spec) => (
            <label
              key={spec.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={filters.specializations.includes(spec.value)}
                onChange={() => toggleSpec(spec.value)}
                className="size-4 rounded border-input accent-[#CC3A3A]"
              />
              {spec.label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price range */}
      <div>
        <Label className="text-sm font-semibold mb-3">Цена (₽/час)</Label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            placeholder="От"
            value={filters.priceMin}
            onChange={(e) =>
              onChange({ ...filters, priceMin: (e.target as HTMLInputElement).value })
            }
            className="h-9 w-full"
            min={0}
            aria-label="Минимальная цена"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            placeholder="До"
            value={filters.priceMax}
            onChange={(e) =>
              onChange({ ...filters, priceMax: (e.target as HTMLInputElement).value })
            }
            className="h-9 w-full"
            min={0}
            aria-label="Максимальная цена"
          />
        </div>
      </div>

      <Separator />

      {/* Minimum rating */}
      <div>
        <Label className="text-sm font-semibold mb-3">Минимальный рейтинг</Label>
        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = Number(filters.minRating) >= star
            return (
              <button
                key={star}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    minRating: filters.minRating === String(star) ? "" : String(star),
                  })
                }
                className="p-0.5 transition-colors"
                aria-label={`Минимум ${star} ${star === 1 ? "звезда" : star < 5 ? "звезды" : "звёзд"}`}
              >
                <Star
                  className={`size-6 ${
                    isActive
                      ? "fill-amber-400 text-amber-400"
                      : "fill-muted text-muted-foreground/40"
                  }`}
                />
              </button>
            )
          })}
          {filters.minRating && (
            <span className="ml-2 text-sm text-muted-foreground">
              от {filters.minRating}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Languages */}
      <div>
        <Label className="text-sm font-semibold mb-3">Язык преподавания</Label>
        <div className="mt-2 flex flex-col gap-2">
          {LANGUAGES.map((lang) => (
            <label
              key={lang.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={filters.languages.includes(lang.value)}
                onChange={() => toggleLang(lang.value)}
                className="size-4 rounded border-input accent-[#CC3A3A]"
              />
              {lang.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---- Desktop Sidebar ----

export function TeacherFiltersSidebar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const filters = parseFiltersFromParams(searchParams)

  const applyFilters = useCallback(
    (newFilters: FilterValues) => {
      const params = filtersToParams(newFilters)
      startTransition(() => {
        router.push(`/teachers?${params.toString()}`, { scroll: false })
      })
    },
    [router, startTransition]
  )

  const resetFilters = useCallback(() => {
    startTransition(() => {
      router.push("/teachers", { scroll: false })
    })
  }, [router, startTransition])

  const hasActiveFilters =
    filters.specializations.length > 0 ||
    filters.priceMin ||
    filters.priceMax ||
    filters.minRating ||
    filters.languages.length > 0

  return (
    <aside className="hidden lg:block w-64 shrink-0" aria-label="Фильтры преподавателей">
      <div className="sticky top-24 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Фильтры</h2>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 size-3" />
              Сбросить
            </Button>
          )}
        </div>
        <FilterControls filters={filters} onChange={applyFilters} />
      </div>
    </aside>
  )
}

// ---- Mobile Sheet ----

export function TeacherFiltersMobile() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const initialFilters = parseFiltersFromParams(searchParams)
  const [localFilters, setLocalFilters] = useState<FilterValues>(initialFilters)
  const [open, setOpen] = useState(false)

  const hasActiveFilters =
    initialFilters.specializations.length > 0 ||
    initialFilters.priceMin ||
    initialFilters.priceMax ||
    initialFilters.minRating ||
    initialFilters.languages.length > 0

  const activeCount =
    initialFilters.specializations.length +
    (initialFilters.priceMin ? 1 : 0) +
    (initialFilters.priceMax ? 1 : 0) +
    (initialFilters.minRating ? 1 : 0) +
    initialFilters.languages.length

  const applyAndClose = () => {
    const params = filtersToParams(localFilters)
    startTransition(() => {
      router.push(`/teachers?${params.toString()}`, { scroll: false })
    })
    setOpen(false)
  }

  const resetAndClose = () => {
    startTransition(() => {
      router.push("/teachers", { scroll: false })
    })
    setOpen(false)
  }

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="default" className="relative">
              <Filter className="mr-2 size-4" />
              Фильтры
              {activeCount > 0 && (
                <span className="ml-1.5 flex size-5 items-center justify-center rounded-full bg-[#CC3A3A] text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </Button>
          }
        />
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Фильтры</SheetTitle>
            <SheetDescription>
              Настройте параметры поиска преподавателя
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-2">
            <FilterControls filters={localFilters} onChange={setLocalFilters} />
          </div>
          <SheetFooter>
            {hasActiveFilters && (
              <Button variant="outline" onClick={resetAndClose} className="w-full">
                Сбросить
              </Button>
            )}
            <Button
              onClick={applyAndClose}
              className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
            >
              Применить
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---- Pagination ----

export function TeacherPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  if (totalPages <= 1) return null

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) {
      params.set("page", String(page))
    } else {
      params.delete("page")
    }
    startTransition(() => {
      router.push(`/teachers?${params.toString()}`)
    })
  }

  // Build visible page numbers
  const pages: (number | "ellipsis")[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push("ellipsis")
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis")
    pages.push(totalPages)
  }

  return (
    <nav aria-label="Навигация по страницам" className="flex items-center justify-center gap-1 pt-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Предыдущая страница"
      >
        <ChevronDown className="size-4 rotate-90" />
      </Button>

      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`e-${idx}`} className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => goToPage(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={
              page === currentPage
                ? "bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                : ""
            }
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Следующая страница"
      >
        <ChevronDown className="size-4 -rotate-90" />
      </Button>
    </nav>
  )
}
