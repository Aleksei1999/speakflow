"use client"

// Модалка «Файлы / Папки» — Figma 2208:3749 (Вкладка с папками).
// Сетка карточек-папок 4×N + кнопки «Добавить файл» и «Выбрать».
// 4 состояния иконки:
//   default   — закрытая папка + маленький ↓-бейдж
//   open      — открытая папка (при клике/hover)
//   loading   — в процессе загрузки, круг заполняется по progress (0..1)
//   loaded    — файл загружен, крупная ↓-стрелка в центре
//
// «Добавить файл» открывает file picker (accept — из props); при выборе
// файла вызывает onFilePicked. Загрузку/POST метаданных делает родитель.
//
// Стили — public/dashboard/files-modal.css.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type FileItemStatus = "default" | "open" | "loading" | "loaded"

export interface FileItem {
  id: string
  name: string
  status: FileItemStatus
  /** 0..1, только для status="loading". */
  progress?: number
  onOpen?: () => void
}

interface FilesModalProps {
  title?: string
  files: FileItem[]
  onClose: () => void
  /** Вызывается когда пользователь выбрал файл через picker. */
  onFilePicked?: (file: File) => void
  /** MIME-фильтр для <input type="file" accept="...">. */
  accept?: string
  /** Разрешить множественный выбор. Если true, onFilePicked дёргается для каждого. */
  multiple?: boolean
  /** Обработчик удаления. Получает ids выбранных файлов. Если не задан —
   *  кнопка «Выбрать» не отображается. */
  onDelete?: (ids: string[]) => Promise<void> | void
  addLabel?: string
  selectLabel?: string
  deleteLabel?: string
  cancelLabel?: string
  /** Скрыть кнопку «Добавить файл» — например для read-only библиотеки ученика. */
  hideAdd?: boolean
}

export function FilesModal({
  title,
  files,
  onClose,
  onFilePicked,
  accept,
  multiple = false,
  onDelete,
  addLabel = "Добавить файл",
  selectLabel = "Выбрать",
  deleteLabel = "Удалить",
  cancelLabel = "Отмена",
  hideAdd = false,
}: FilesModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Если файлы вдруг закончились — выходим из режима выбора
  useEffect(() => {
    if (files.length === 0 && selectMode) {
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  }, [files.length, selectMode])

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDelete = async () => {
    if (!onDelete || selectedIds.size === 0) return
    setDeleting(true)
    try {
      await onDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
      setSelectMode(false)
    } finally {
      setDeleting(false)
    }
  }

  const hasFiles = files.length > 0
  const showSelect = hasFiles && !!onDelete

  if (!mounted) return null

  return createPortal(
    <div className="files-modal-backdrop" onClick={onClose}>
      <div
        className="files-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Файлы"}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="files-modal-close" aria-label="Закрыть" onClick={onClose}>
          <svg viewBox="0 0 14 14" width="14" height="14" fill="none" aria-hidden>
            <path d="M1 1l12 12M13 1L1 13" stroke="#1E1E1E" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {/* скрытый <input type="file"> — открывается программно */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : []
            files.forEach((f) => onFilePicked?.(f))
            e.target.value = ""
          }}
        />

        <div className="files-modal-grid">
          {!hasFiles ? (
            <div className="files-modal-empty">
              Пока нет ни одного файла. Нажми «Добавить файл» чтобы загрузить с компьютера или телефона.
            </div>
          ) : (
            files.map((f) => {
              const isSelected = selectedIds.has(f.id)
              const isLoading = f.status === "loading"
              return (
                <button
                  type="button"
                  key={f.id}
                  className={`files-item files-item--${f.status}${
                    selectMode ? " files-item--select-mode" : ""
                  }${isSelected ? " is-selected" : ""}`}
                  onClick={() => {
                    if (isLoading) return
                    if (selectMode) toggleSelected(f.id)
                    else f.onOpen?.()
                  }}
                  disabled={isLoading}
                  aria-label={f.name}
                  aria-pressed={selectMode ? isSelected : undefined}
                >
                  <FileIcon
                    status={f.status}
                    progress={f.progress ?? 0}
                    selecting={selectMode}
                    selected={isSelected}
                  />
                  <span className="files-item-name">{f.name}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="files-modal-footer">
          {!hideAdd && (
            <button
              type="button"
              className="files-modal-btn"
              onClick={() => inputRef.current?.click()}
              disabled={deleting}
            >
              {addLabel}
            </button>
          )}

          {showSelect && !selectMode && (
            <button
              type="button"
              className="files-modal-btn"
              onClick={() => setSelectMode(true)}
            >
              {selectLabel}
            </button>
          )}

          {selectMode && (
            <div className="files-modal-btn-group">
              <button
                type="button"
                className="files-modal-btn"
                onClick={() => {
                  setSelectMode(false)
                  setSelectedIds(new Set())
                }}
                disabled={deleting}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="files-modal-btn files-modal-btn--danger"
                onClick={handleDelete}
                disabled={deleting || selectedIds.size === 0}
              >
                {deleting ? "Удаление…" : `${deleteLabel}${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ---------- иконка папки в 4 состояниях ----------

function FileIcon({
  status,
  progress,
  selecting = false,
  selected = false,
}: {
  status: FileItemStatus
  progress: number
  selecting?: boolean
  selected?: boolean
}) {
  // В режиме выбора любая папка рендерится плоской + чекбокс-круг снизу
  // (Figma 4105:74 / 4105:75).
  if (selecting) return <IconFolderSelect selected={selected} />
  if (status === "open") return <IconFolderOpen />
  if (status === "loading") return <IconFolderLoading progress={progress} />
  if (status === "loaded") return <IconFolderLoaded />
  return <IconFolderDefault />
}

function IconFolderSelect({ selected }: { selected: boolean }) {
  // Figma: unselected = 4105:74 (белый круг), selected = 4106:76 (тёмный круг + галочка)
  return (
    <svg viewBox="0 0 146 160" width="146" height="160" className="files-icon" aria-hidden>
      <FolderShape />
      <circle
        cx="73"
        cy="140"
        r="17"
        fill={selected ? "#1E1E1E" : "#FFFFFF"}
        stroke="#DFED8C"
        strokeWidth="2"
      />
      {selected && (
        <path
          d="M65 141.292L70.6471 147L81 134"
          stroke="#DFED8C"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </svg>
  )
}

// Общая база — плоская закрытая папка 146×140. Используется в default/loading/loaded.
function FolderShape() {
  return (
    <path
      d="M123.72 15.5859H97.907C89.1216 15.5859 80.5174 12.5781 73.7246 6.92708C68.7432 2.91667 64.7581 0 58.6898 0H22.2804C9.96278 0 0 10.026 0 22.4219V38.0078V117.578C0 129.974 9.96278 140 22.2804 140H58.6898H123.72C136.037 140 146 129.974 146 117.578V38.0078C146 25.612 136.037 15.5859 123.72 15.5859Z"
      fill="#1E1E1E"
    />
  )
}

function IconFolderDefault() {
  return (
    <svg viewBox="0 0 146 175" width="146" height="175" className="files-icon" aria-hidden>
      <FolderShape />
      {/* маленький бейдж-круг с ↓ в правом-нижнем углу */}
      <g transform="translate(94, 122)">
        <circle cx="18" cy="17.5" r="17" fill="#1E1E1E" stroke="#DFED8C" strokeWidth="2" />
        <path
          d="M19.5 9C19.5 8.17157 18.8284 7.5 18 7.5C17.1716 7.5 16.5 8.17157 16.5 9L18 9L19.5 9ZM16.9393 27.0607C17.5251 27.6464 18.4749 27.6464 19.0607 27.0607L28.6066 17.5147C29.1924 16.9289 29.1924 15.9792 28.6066 15.3934C28.0208 14.8076 27.0711 14.8076 26.4853 15.3934L18 23.8787L9.51472 15.3934C8.92893 14.8076 7.97919 14.8076 7.3934 15.3934C6.80761 15.9792 6.80761 16.9289 7.3934 17.5147L16.9393 27.0607ZM18 9L16.5 9L16.5 26L18 26L19.5 26L19.5 9L18 9Z"
          fill="#DFED8C"
        />
      </g>
    </svg>
  )
}

function IconFolderOpen() {
  return (
    <svg viewBox="0 0 166 175" width="166" height="175" className="files-icon" aria-hidden>
      <path
        d="M159.971 56.0912C155.797 52.7166 149.899 50.9837 142.277 50.9837H56.8927C48.0003 50.9837 40.1062 57.3681 38.2007 66.1238L28.1288 112.091C27.6751 114.189 25.7696 115.648 23.6826 115.648C23.3197 115.648 23.0474 115.648 22.6845 115.557C20.2346 115.01 18.692 112.547 19.2364 110.085L29.3083 64.0261C32.1212 51.2573 43.7357 41.8632 56.8927 41.8632H142.277C143.638 41.8632 144.999 41.9544 146.27 42.0456V38.0326C146.27 25.6287 136.288 15.5961 123.948 15.5961H98.0877C89.2861 15.5961 80.666 12.5863 73.8607 6.9316C68.9608 2.91857 64.9683 0 58.7982 0H22.3215C9.98118 0 0 10.0326 0 22.4365V38.0326V117.564C0 129.967 9.98118 140 22.3215 140H46.8208H58.7982H123.948H132.84C144.092 140 153.801 132.065 156.069 121.029L165.506 74.9707C166.504 70.0456 165.96 65.2117 164.145 61.0163C163.056 59.101 161.604 57.4593 159.971 56.0912Z"
        fill="#1E1E1E"
      />
    </svg>
  )
}

// Loading: папка + круг, который заполняется по progress (0..1).
// Реализовано через stroke-dasharray/offset на круге (r=39, C ≈ 245).
function IconFolderLoading({ progress }: { progress: number }) {
  const CIRC = 245 // 2πr при r≈39
  const clamped = Math.max(0, Math.min(1, progress))
  return (
    <svg viewBox="0 0 146 175" width="146" height="175" className="files-icon" aria-hidden>
      <FolderShape />
      {/* задник — тонкий тёмный круг */}
      <circle cx="74" cy="82.5" r="39" fill="none" stroke="rgba(223,237,140,0.25)" strokeWidth="6" />
      {/* progress-arc */}
      <circle
        cx="74"
        cy="82.5"
        r="39"
        fill="none"
        stroke="#DFED8C"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - clamped)}
        transform="rotate(-90 74 82.5)"
        style={{ transition: "stroke-dashoffset .3s linear" }}
      />
      {/* ↓ стрелка в центре */}
      <path
        d="M77 66C77 64.3431 75.6569 63 74 63C72.3431 63 71 64.3431 71 66L74 66L77 66ZM71.8787 102.121C73.0503 103.293 74.9497 103.293 76.1213 102.121L95.2132 83.0294C96.3848 81.8579 96.3848 79.9584 95.2132 78.7868C94.0416 77.6152 92.1421 77.6152 90.9706 78.7868L74 95.7574L57.0294 78.7868C55.8579 77.6152 53.9584 77.6152 52.7868 78.7868C51.6152 79.9584 51.6152 81.8579 52.7868 83.0294L71.8787 102.121ZM74 66L71 66L71 100L74 100L77 100L77 66L74 66Z"
        fill="#DFED8C"
      />
    </svg>
  )
}

function IconFolderLoaded() {
  return (
    <svg viewBox="0 0 146 175" width="146" height="175" className="files-icon" aria-hidden>
      <FolderShape />
      {/* Крупная ↓-стрелка в центре папки (arrow-down-thin из Figma, повёрнута 90°) */}
      <g transform="translate(52, 55) rotate(90 20 22.09)">
        <path
          d="M3 19.0919C1.34315 19.0919 0 20.435 0 22.0919C0 23.7487 1.34315 25.0919 3 25.0919V22.0919V19.0919ZM39.1213 24.2132C40.2929 23.0416 40.2929 21.1421 39.1213 19.9706L20.0294 0.878681C18.8579 -0.292892 16.9584 -0.292892 15.7868 0.878681C14.6152 2.05025 14.6152 3.94975 15.7868 5.12132L32.7574 22.0919L15.7868 39.0624C14.6152 40.234 14.6152 42.1335 15.7868 43.3051C16.9584 44.4767 18.8579 44.4767 20.0294 43.3051L39.1213 24.2132ZM3 22.0919V25.0919H37V22.0919V19.0919H3V22.0919Z"
          fill="#DFED8C"
        />
      </g>
    </svg>
  )
}
