"use client"

import { useAuth } from "@/lib/auth-context"
import { users } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LogIn } from "lucide-react"

export function UserSelector() {
  const { currentUser, login } = useAuth()

  return (
    <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg border">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Usuário Atual</h3>
        {currentUser && (
          <div className="flex flex-col gap-1 mb-4 p-3 bg-card rounded border border-border">
            <p className="text-sm font-medium text-foreground">{currentUser.nome}</p>
            <p className="text-xs text-muted-foreground">{currentUser.email}</p>
            <span className="inline-block mt-2 text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary w-fit">
              {currentUser.role === "admin" ? "Administrador" : "Vendedor"}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">Trocar de Usuário</label>
          <Select value={currentUser?.id?.toString() || ""} onValueChange={login}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  <div className="flex items-center gap-2">
                    <LogIn className="size-3" />
                    <span>
                      {user.nome} ({user.role === "admin" ? "Admin" : "Vendedor"})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
