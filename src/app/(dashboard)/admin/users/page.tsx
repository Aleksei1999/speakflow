// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Ban,
  Eye,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RoleGuard } from '@/components/auth/role-guard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

const PAGE_SIZE = 20

type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin'
  is_active: boolean
  created_at: string
}

type SortField = 'created_at' | 'full_name'
type SortDir = 'asc' | 'desc'

const roleBadgeColors: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  teacher: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  admin: 'bg-[#CC3A3A]/10 text-[#CC3A3A] dark:bg-[#CC3A3A]/20',
}

const roleLabels: Record<string, string> = {
  student: 'Ученик',
  teacher: 'Преподаватель',
  admin: 'Админ',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function AdminUsersContent() {
  const [users, setUsers] = useState<Profile[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [newRole, setNewRole] = useState<string>('student')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, is_active, created_at', {
        count: 'exact',
      })

    if (searchQuery.trim()) {
      query = query.or(
        `full_name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`
      )
    }

    if (roleFilter !== 'all') {
      query = query.eq('role', roleFilter)
    }

    if (statusFilter === 'active') {
      query = query.eq('is_active', true)
    } else if (statusFilter === 'inactive') {
      query = query.eq('is_active', false)
    }

    query = query
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (!error) {
      setUsers((data as Profile[]) ?? [])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [searchQuery, roleFilter, statusFilter, sortField, sortDir, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [searchQuery, roleFilter, statusFilter, sortField, sortDir])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleChangeRole = async () => {
    if (!selectedUser) return
    setActionLoading(true)
    const supabase = createClient()

    await supabase
      .from('profiles')
      .update({ role: newRole as 'student' | 'teacher' | 'admin' })
      .eq('id', selectedUser.id)

    setRoleDialogOpen(false)
    setSelectedUser(null)
    setActionLoading(false)
    fetchUsers()
  }

  const handleToggleBlock = async (user: Profile) => {
    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    fetchUsers()
  }

  const openRoleDialog = (user: Profile) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setRoleDialogOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Управление <span className="gl">пользователями</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Просмотр и управление аккаунтами пользователей
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Роль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            <SelectItem value="student">Ученики</SelectItem>
            <SelectItem value="teacher">Преподаватели</SelectItem>
            <SelectItem value="admin">Админы</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Неактивные</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Аватар</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => handleToggleSort('full_name')}
                >
                  Имя
                  {sortField === 'full_name' && (
                    <span className="text-xs">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => handleToggleSort('created_at')}
                >
                  Дата регистрации
                  {sortField === 'created_at' && (
                    <span className="text-xs">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              </TableHead>
              <TableHead className="w-12">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div
                      className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      style={{ color: '#CC3A3A' }}
                    />
                    <span className="text-sm text-muted-foreground">
                      Загрузка...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  Пользователи не найдены
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar size="sm">
                      {user.avatar_url ? (
                        <AvatarImage
                          src={user.avatar_url}
                          alt={user.full_name}
                        />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.full_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={roleBadgeColors[user.role]}
                    >
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.is_active ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Активен
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Заблокирован
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'd MMM yyyy', {
                      locale: ru,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Действия</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(
                              `/admin/users/${user.id}`,
                              '_blank'
                            )
                          }
                        >
                          <Eye className="size-4" />
                          Просмотр профиля
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openRoleDialog(user)}
                        >
                          <UserCog className="size-4" />
                          Сменить роль
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleToggleBlock(user)}
                          className={
                            user.is_active ? 'text-destructive' : ''
                          }
                        >
                          {user.is_active ? (
                            <>
                              <Ban className="size-4" />
                              Заблокировать
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="size-4" />
                              Разблокировать
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {page * PAGE_SIZE + 1}
            {' - '}
            {Math.min((page + 1) * PAGE_SIZE, totalCount)} из {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={page >= totalPages - 1}
            >
              Далее
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сменить роль пользователя</DialogTitle>
            <DialogDescription>
              Изменение роли для{' '}
              <span className="font-medium text-foreground">
                {selectedUser?.full_name}
              </span>
              . Текущая роль:{' '}
              <span className="font-medium text-foreground">
                {selectedUser ? roleLabels[selectedUser.role] : ''}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Ученик</SelectItem>
                <SelectItem value="teacher">Преподаватель</SelectItem>
                <SelectItem value="admin">Админ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={actionLoading}
            >
              Отмена
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={
                actionLoading || newRole === selectedUser?.role
              }
              style={{ backgroundColor: '#CC3A3A' }}
              className="text-white hover:opacity-90"
            >
              {actionLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AdminUsersContent />
    </RoleGuard>
  )
}
