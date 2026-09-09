"use client"

// Модалка «Файлы / Папки» — Figma 2522:10421 «Вкладка с папками» (корень).
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
import CustomScroll from "@/components/dashboard/CustomScroll"

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
      // Если пользователь был внутри папки — возвращаем в корень, чтобы он
      // увидел свою новую папку и мог сразу переименовать.
      if (effectiveFolderId && !legacyMode) onOpenFolder(null)
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
  // Ученик (read-only) в корне: кнопок нет — подвал не рендерим (Figma 2522:10421 без кнопок).
  const showFooter =
    (canManage && !legacyMode && !inFolder && !selectMode && !!onCreateFolder) ||
    (canManage && inFolder && !selectMode) ||
    showSelect ||
    selectMode

  return createPortal(
    <div className="files-modal-backdrop" onClick={onClose}>
      <div
        className={`files-modal${showFooter ? " files-modal--with-footer" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Файлы"}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="files-modal-close" aria-label="Закрыть" onClick={onClose}>
          {/* крестик — экспорт Figma Group 180 (13.33×13.34) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dashboard/ic-close-dark.svg" alt="" aria-hidden />
        </button>

        {inFolder && !legacyMode && (
          <div className="files-modal-crumbs">
            <button
              type="button"
              className="files-modal-back"
              onClick={() => onOpenFolder(null)}
              aria-label="Назад к папкам"
            >
              {/* стрелка — экспорт Figma Vector 43 (тёмная стрелка 20×22), повёрнута влево */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dashboard/ic-dd-arrow-dark.svg" alt="" aria-hidden className="files-modal-back-ic" />
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

        <CustomScroll className="files-modal-body">
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
                  className={`files-item files-item--file files-item--${f.status}${
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
                onRename={onRenameFolder ? (name) => onRenameFolder(folder.id, name) : undefined}
              />
            ))
          )}
        </div>
        </CustomScroll>

        {showFooter && (
        <div className="files-modal-footer">
          {/* «Создать папку» — слева. «Добавить файл» + «Выбрать» — вместе справа.
              В selectMode: «Отмена» слева от «Удалить» и вся пара справа. */}
          {canManage && !legacyMode && !inFolder && !selectMode && onCreateFolder && (
            <button
              type="button"
              className="files-modal-btn files-modal-btn--add" /* 222×46 (2522:4113) */
              onClick={handleCreateFolder}
              disabled={creating || deleting}
            >
              {creating ? "Создаём…" : createFolderLabel}
            </button>
          )}
          {/* «Добавить файл» 222×46 слева (2522:10458) */}
          {canManage && inFolder && !selectMode && (
            <button
              type="button"
              className="files-modal-btn files-modal-btn--add"
              onClick={() => inputRef.current?.click()}
              disabled={deleting}
            >
              {addLabel}
            </button>
          )}

          <div className="files-modal-footer-right">

            {showSelect && !selectMode && (
              <button
                type="button"
                className="files-modal-btn"
                onClick={() => setSelectMode(true)}
              >
                {selectLabel}
              </button>
            )}
            {/* Figma 2522:10358 «В папке»: рядом с «Выбрать» (772) сразу стоит красная «Удалить» (957);
                без выбранных файлов она открывает режим выбора */}
            {showSelect && !selectMode && inFolder && (
              <button
                type="button"
                className="files-modal-btn files-modal-btn--danger"
                onClick={() => setSelectMode(true)}
              >
                {deleteLabel}
              </button>
            )}

            {/* Figma 2522:4140: «Удалить» 160×46 red на (957,718) без счётчика; «Отмена» слева от неё оставлена
                по просьбе заказчика, чтобы выходить из режима выбора без закрытия модалки */}
            {selectMode && (
              <>
                <button
                  type="button"
                  className="files-modal-btn"
                  onClick={() => {
                    setSelectMode(false)
                    setSelectedIds(new Set())
                  }}
                  disabled={deleting}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="files-modal-btn files-modal-btn--danger"
                  onClick={handleDeleteConfirm}
                  disabled={deleting || selectedIds.size === 0}
                >
                  {deleting ? "Удаление…" : deleteLabel}
                </button>
              </>
            )}
          </div>
        </div>
        )}
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
      {selectMode ? <IconFolderSelect selected={selected} /> : <FolderIcon />}
      {canManage && !!onRename && !selectMode ? (
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
    <img src={src} alt="" aria-hidden className={`files-icon files-icon--file${isImage ? " files-icon--image" : ""}`} width={width} height={height} />
  )
}

// ---------------------------------------------------------------------------
// Иконки папки — экспорт Figma 2522:10421: папка 146×140 + бейдж «скачать» 36×35 (Group 294),
// открытая папка 166×140 (показываем при наведении), состояния загрузки: круг-прогресс 84×85 + стрелка.
// ---------------------------------------------------------------------------
export type FolderIconState = "default" | "open" | "loading" | "loaded"

export function FolderIcon({ state = "default" }: { state?: FolderIconState }) {
  return (
    <span className={`files-folder files-folder--${state}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-folder-shape" src="/dashboard/files/folder.svg" alt="" width={146} height={140} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-folder-open" src="/dashboard/files/folder-open.svg" alt="" width={166} height={140} />
      {state === "default" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="files-folder-badge" src="/dashboard/files/folder-badge-download.svg" alt="" width={36} height={35} />
      )}
      {state === "loading" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="files-folder-progress" src="/dashboard/files/folder-progress.svg" alt="" width={84} height={85} />
      )}
      {(state === "loading" || state === "loaded") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="files-folder-arrow" src="/dashboard/files/folder-arrow.svg" alt="" width={40} height={44} />
      )}
    </span>
  )
}

// Чекбокс режима выбора — экспорт Figma 2522:10458: Group 183 (белый круг 36) / Group 184 (тёмный) + Vector 40 (галочка)
function SelectCircle({ selected }: { selected: boolean }) {
  return (
    <span className="files-check" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-check-circle" src={selected ? "/dashboard/files/check-on.svg" : "/dashboard/files/check-off.svg"} alt="" width={36} height={36} />
      {selected && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="files-check-mark" src="/dashboard/files/check-mark.svg" alt="" width={20} height={17} />
      )}
    </span>
  )
}

function IconFolderSelect({ selected }: { selected: boolean }) {
  return (
    <span className="files-folder files-folder--select" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-folder-shape" src="/dashboard/files/folder.svg" alt="" width={146} height={140} />
      <SelectCircle selected={selected} />
    </span>
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
    <span className={`files-icon files-icon--file-wrap${isImage ? " files-icon--image" : ""}`} style={{ width: w, height: h }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={w} height={h} className="files-icon--file" />
      <SelectCircle selected={selected} />
    </span>
  )
}

// Загрузка файла: тёмная иконка файла + круг-прогресс и стрелка из макета папок (Figma 2522:10421)
function IconFileLoading({ progress }: { progress: number }) {
  const clamped = Math.max(0, Math.min(1, progress))
  return (
    <span className="files-icon files-icon--file-wrap files-icon--loading" style={{ width: 112, height: 138 }} aria-hidden title={`${Math.round(clamped * 100)}%`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dashboard/file-types/generic.svg" alt="" width={112} height={138} className="files-icon--file" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-folder-progress" src="/dashboard/files/folder-progress.svg" alt="" width={84} height={85} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="files-folder-arrow" src="/dashboard/files/folder-arrow.svg" alt="" width={40} height={44} />
    </span>
  )
}
