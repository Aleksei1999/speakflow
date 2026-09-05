"use client"

// Модалка «Файлы / Папки» — Figma 2208:3749.
//
// Двухуровневая навигация:
//   • Корень (view='folders')   — список папок. Кнопка «Создать папку» вместо
//     «Добавить файл». Новая папка сразу появляется как карточка с inline-инпутом,
//     авто-сохранение по debounce (без «Сохранить/Отмена»).
//   • Внутри папки (view='files') — файлы этой папки. Появляется «Назад»,
//     «Добавить файл», «Выбрать» / «Удалить» — как было раньше.
//
// Права: студент — read-only (`canManage=false`). Учитель/админ создают
// папки, добавляют/удаляют файлы.
//
// Иконки файлов подбираются по MIME/расширению (см. `fileTypeIcon`).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

export type FileItemStatus = "default" | "open" | "loading" | "loaded"

export interface FileItem {
  id: string
  name: string
  status: FileItemStatus
  /** 0..1, только для status="loading". */
  progress?: number
  /** MIME-тип файла — используется, чтобы отрисовать нужную PDF/WORD/PNG иконку. */
  mime?: string | null
  /** Расширение (без точки), если mime не помогает угадать. */
  ext?: string | null
  onOpen?: () => void
}

export interface FolderItem {
  id: string
  name: string
  /** Кол-во файлов в папке — показываем маленьким бейджем над названием (optional). */
  count?: number
}

interface FilesModalProps {
  title?: string
  folders?: FolderItem[]
  /** Файлы текущей открытой папки. Родитель фильтрует/подгружает при смене folderId. */
  files: FileItem[]
  /** ID открытой папки. null → показываем корень (список папок).
   *  Игнорируется в legacyMode. */
  activeFolderId?: string | null
  onOpenFolder?: (folderId: string | null) => void
  /** Обратная совместимость: старый flat-file режим (без папок). Показываем
   *  сразу список файлов, без breadcrumb / «Создать папку». */
  legacyMode?: boolean
  /** Создать папку. Возвращает id новой папки (родитель сам вставляет в список). */
  onCreateFolder?: () => Promise<string>
  /** Переименовать. Родитель авто-обновляет `folders`. */
  onRenameFolder?: (folderId: string, name: string) => Promise<void>
  /** Удалить папки. */
  onDeleteFolders?: (ids: string[]) => Promise<void>
  onClose: () => void
  onFilePicked?: (file: File) => void
  accept?: string
  multiple?: boolean
  onDeleteFiles?: (ids: string[]) => Promise<void> | void
  /** true → пользователь может создавать папки, добавлять/удалять файлы. */
  canManage?: boolean
  addLabel?: string
  selectLabel?: string
  deleteLabel?: string
  cancelLabel?: string
  createFolderLabel?: string
}

const DEBOUNCE_MS = 600

export function FilesModal({
  title,
  folders = [],
  files,
  activeFolderId = null,
  onOpenFolder = () => {},
  onCreateFolder,
  onRenameFolder,
  onDeleteFolders,
  onClose,
  onFilePicked,
  accept,
  multiple = false,
  onDeleteFiles,
  canManage = false,
  addLabel = "Добавить файл",
  selectLabel = "Выбрать",
  deleteLabel = "Удалить",
  cancelLabel = "Отмена",
  createFolderLabel = "Создать папку",
  legacyMode = false,
}: FilesModalProps) {
  // В legacy-режиме принудительно «в папке» — файлы рендерим сразу, без корня.
  const effectiveFolderId = legacyMode ? "__legacy__" : activeFolderId
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Сбрасываем выбор при смене «view».
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [effectiveFolderId])

  useEffect(() => {
    const current = effectiveFolderId ? files : folders
    if (current.length === 0 && selectMode) {
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  }, [effectiveFolderId, files.length, folders.length, selectMode, files, folders])

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteConfirm = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      if (effectiveFolderId) {
        await onDeleteFiles?.(Array.from(selectedIds))
      } else {
        await onDeleteFolders?.(Array.from(selectedIds))
      }
      setSelectedIds(new Set())
      setSelectMode(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!onCreateFolder || creating) return
    setCreating(true)
    try {
      await onCreateFolder()
    } finally {
      setCreating(false)
    }
  }

  if (!mounted) return null

  const inFolder = effectiveFolderId !== null
  const activeFolder = inFolder ? folders.find((f) => f.id === effectiveFolderId) ?? null : null
  const hasItems = inFolder ? files.length > 0 : folders.length > 0
  const canDelete = inFolder ? !!onDeleteFiles : !!onDeleteFolders
  const showSelect = hasItems && canManage && canDelete

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

        {inFolder && !legacyMode && (
          <div className="files-modal-crumbs">
            <button
              type="button"
              className="files-modal-back"
              onClick={() => onOpenFolder(null)}
              aria-label="Назад к папкам"
            >
              <svg viewBox="0 0 20 14" width="20" height="14" fill="none" aria-hidden>
                <path d="M7 1L1 7l6 6M1 7h18" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{activeFolder?.name ?? "Папка"}</span>
            </button>
          </div>
        )}

        {/* скрытый <input type="file"> — открывается программно */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : []
            list.forEach((f) => onFilePicked?.(f))
            e.target.value = ""
          }}
        />

        <div className="files-modal-grid">
          {!hasItems ? (
            <div className="files-modal-empty">
              {inFolder
                ? canManage
                  ? "В этой папке пока нет файлов. Нажми «Добавить файл»."
                  : "В этой папке пока нет файлов."
                : canManage
                  ? "Пока нет ни одной папки. Нажми «Создать папку»."
                  : "Здесь пока пусто."}
            </div>
          ) : inFolder ? (
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
                  <FileTypeIcon
                    status={f.status}
                    progress={f.progress ?? 0}
                    selecting={selectMode}
                    selected={isSelected}
                    mime={f.mime ?? null}
                    ext={f.ext ?? null}
                    name={f.name}
                  />
                  <span className="files-item-name">{f.name}</span>
                </button>
              )
            })
          ) : (
            folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                selectMode={selectMode}
                selected={selectedIds.has(folder.id)}
                canManage={canManage}
                onOpen={() => onOpenFolder(folder.id)}
                onToggleSelect={() => toggleSelected(folder.id)}
                onRename={(name) => onRenameFolder?.(folder.id, name)}
              />
            ))
          )}
        </div>

        <div className="files-modal-footer">
          {canManage && !inFolder && !selectMode && onCreateFolder && (
            <button
              type="button"
              className="files-modal-btn"
              onClick={handleCreateFolder}
              disabled={creating || deleting}
            >
              {creating ? "Создаём…" : createFolderLabel}
            </button>
          )}

          {canManage && inFolder && !selectMode && (
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
                onClick={handleDeleteConfirm}
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

// ---------------------------------------------------------------------------
// Folder card — inline-editable name (debounced auto-save, без «Сохранить»).
// ---------------------------------------------------------------------------
function FolderCard({
  folder,
  selectMode,
  selected,
  canManage,
  onOpen,
  onToggleSelect,
  onRename,
}: {
  folder: FolderItem
  selectMode: boolean
  selected: boolean
  canManage: boolean
  onOpen: () => void
  onToggleSelect: () => void
  onRename?: (name: string) => Promise<void> | void
}) {
  const [draft, setDraft] = useState(folder.name)
  const savedRef = useRef(folder.name)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Синхронизация draft ← props (например, кто-то переименовал папку из
  // другой сессии, или после reload).
  useEffect(() => {
    setDraft(folder.name)
    savedRef.current = folder.name
  }, [folder.name])

  const scheduleSave = useCallback(
    (next: string) => {
      if (!onRename) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const trimmed = next.trim() || "Новая папка"
        if (trimmed === savedRef.current) return
        try {
          await onRename(trimmed)
          savedRef.current = trimmed
        } catch (err) {
          console.error("[FilesModal] rename folder failed", err)
        }
      }, DEBOUNCE_MS)
    },
    [onRename],
  )

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div
      className={`files-item files-item--folder${selectMode ? " files-item--select-mode" : ""}${
        selected ? " is-selected" : ""
      }`}
      onClick={(e) => {
        // Клик по инпуту — не открываем папку.
        if ((e.target as HTMLElement).tagName === "INPUT") return
        if (selectMode) onToggleSelect()
        else onOpen()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          if (selectMode) onToggleSelect()
          else onOpen()
        }
      }}
      aria-label={folder.name}
      aria-pressed={selectMode ? selected : undefined}
    >
      {selectMode ? <IconFolderSelect selected={selected} /> : <IconFolderDefault />}
      {canManage && !selectMode ? (
        <input
          className="files-item-name files-item-name--input"
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            setDraft(v)
            scheduleSave(v)
          }}
          onBlur={() => scheduleSave(draft)}
          onClick={(e) => e.stopPropagation()}
          maxLength={80}
          aria-label="Название папки"
        />
      ) : (
        <span className="files-item-name">{folder.name}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FileTypeIcon — выбирает нужную SVG по mime/расширению файла.
// Loading/select-mode рендерят папочные состояния (progress-круг и чекбокс),
// т.к. эти состояния нужны только внутри папки перед завершением загрузки.
// ---------------------------------------------------------------------------
function FileTypeIcon({
  status,
  progress,
  selecting,
  selected,
  mime,
  ext,
  name,
}: {
  status: FileItemStatus
  progress: number
  selecting: boolean
  selected: boolean
  mime: string | null
  ext: string | null
  name: string
}) {
  if (selecting) return <IconFileSelect selected={selected} kind={fileTypeIcon(mime, ext, name)} />
  if (status === "loading") return <IconFileLoading progress={progress} />
  const kind = fileTypeIcon(mime, ext, name)
  return <IconFileType kind={kind} />
}

type FileKind = "pdf" | "word" | "excel" | "image" | "generic"

export function fileTypeIcon(mime: string | null, ext: string | null, name?: string): FileKind {
  const extLower = (ext ?? name?.split(".").pop() ?? "").toLowerCase()
  const mimeLower = (mime ?? "").toLowerCase()
  if (mimeLower.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(extLower)) {
    return "image"
  }
  if (mimeLower === "application/pdf" || extLower === "pdf") return "pdf"
  if (
    mimeLower.includes("wordprocessing") ||
    mimeLower === "application/msword" ||
    ["doc", "docx", "rtf", "odt"].includes(extLower)
  ) {
    return "word"
  }
  if (
    mimeLower.includes("spreadsheet") ||
    mimeLower === "application/vnd.ms-excel" ||
    ["xls", "xlsx", "csv", "ods"].includes(extLower)
  ) {
    return "excel"
  }
  return "generic"
}

function IconFileType({ kind }: { kind: FileKind }) {
  const src = `/dashboard/file-types/${kind}.svg`
  const isImage = kind === "image"
  // По ТЗ: обычные файлы 112.031×138.111, картинки 146×132.619.
  const width = isImage ? 146 : 112
  const height = isImage ? 133 : 138
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden className="files-icon files-icon--file" width={width} height={height} />
  )
}

// ---------------------------------------------------------------------------
// Иконки папки (без файлов) — оставлены как раньше.
// ---------------------------------------------------------------------------
function IconFolderSelect({ selected }: { selected: boolean }) {
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
    <svg viewBox="0 0 146 140" width="146" height="140" className="files-icon" aria-hidden>
      <FolderShape />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// File icons — loading (progress) + select-mode (checkbox круг).
// ---------------------------------------------------------------------------
function IconFileSelect({ selected, kind }: { selected: boolean; kind: FileKind }) {
  const src = `/dashboard/file-types/${kind}.svg`
  const isImage = kind === "image"
  const w = isImage ? 146 : 112
  const h = isImage ? 133 : 138
  return (
    <div className="files-icon files-icon--file-wrap" style={{ width: w, height: h + 22, position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden width={w} height={h} style={{ display: "block" }} />
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        style={{ position: "absolute", left: "50%", bottom: -6, transform: "translateX(-50%)" }}
        fill="none"
        aria-hidden
      >
        <circle cx="17" cy="17" r="16" fill={selected ? "#1E1E1E" : "#FFFFFF"} stroke="#DFED8C" strokeWidth="2" />
        {selected && (
          <path
            d="M9 17.5L15 23L25 12"
            stroke="#DFED8C"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  )
}

function IconFileLoading({ progress }: { progress: number }) {
  const CIRC = 245
  const clamped = Math.max(0, Math.min(1, progress))
  return (
    <svg viewBox="0 0 112 138" width="112" height="138" className="files-icon" aria-hidden>
      <rect x="4" y="4" width="104" height="130" rx="14" fill="#1E1E1E" />
      <circle cx="56" cy="69" r="39" fill="none" stroke="rgba(223,237,140,0.25)" strokeWidth="6" />
      <circle
        cx="56"
        cy="69"
        r="39"
        fill="none"
        stroke="#DFED8C"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - clamped)}
        transform="rotate(-90 56 69)"
        style={{ transition: "stroke-dashoffset .3s linear" }}
      />
    </svg>
  )
}
