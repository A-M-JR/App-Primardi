"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, AlertTriangle, ShieldX, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

type ErrorType = "invalid_credentials" | "user_blocked" | null

const errorMessages: Record<NonNullable<ErrorType>, { title: string; description: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
    invalid_credentials: {
        title: "Credenciais inválidas",
        description: "E-mail não encontrado no sistema. Verifique o endereço digitado ou entre em contato com o administrador.",
        icon: AlertTriangle,
        color: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-300 dark:border-amber-700/50",
    },
    user_blocked: {
        title: "Acesso bloqueado",
        description: "Este usuário está desativado no sistema. Entre em contato com o administrador da plataforma para reativar seu acesso.",
        icon: ShieldX,
        color: "text-red-700 dark:text-red-400",
        bg: "bg-red-50 dark:bg-red-950/30",
        border: "border-red-300 dark:border-red-700/50",
    },
}

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [senha, setSenha] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [loginError, setLoginError] = useState<ErrorType>(null)
    const [shakeCard, setShakeCard] = useState(false)
    const router = useRouter()
    const { login } = useAuth()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoggingIn(true)
        setLoginError(null)

        try {
            const result = await login(email, senha)
            if (result === "success") {
                toast.success("Bem-vindo! Sessão iniciada com sucesso.")
                router.push("/")
            } else {
                // Map result to error type
                const errorType: ErrorType = result === "user_blocked" ? "user_blocked" : "invalid_credentials"
                setLoginError(errorType)

                // Shake animation
                setShakeCard(true)
                setTimeout(() => setShakeCard(false), 600)

                setIsLoggingIn(false)
            }
        } catch (error) {
            toast.error("Erro ao conectar com o servidor.")
            setIsLoggingIn(false)
        }
    }

    const currentError = loginError ? errorMessages[loginError] : null

    return (
        <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-y-auto bg-zinc-950 p-6">
            {/* Mesh Gradient Background (Blue/Indigo/Slate) */}
            <div className="fixed inset-0 z-0 bg-gradient-to-br from-[#0f264a] via-[#1a365d] to-[#09090b]">
                {/* Decorative floating orbs */}
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#3b82f6]/20 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#60a5fa]/10 rounded-full blur-[100px] pointer-events-none"></div>
            </div>

            {/* Login Card Container Centralizado */}
            <div className={`w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-700 transition-transform ${shakeCard ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
                {/* Logo da Newflexo acima do Card */}
                <div className="flex justify-center mb-8 drop-shadow-2xl px-4">
                    <img
                        src="/logo_sem_fundo_branca.png"
                        alt="Primardi"
                        className="w-full max-w-[280px] h-auto object-contain drop-shadow-[0_2px_15px_rgba(255,255,255,0.2)] transition-all hover:scale-105 duration-500"
                    />
                </div>

                <div className="w-full">
                    <Card className={`border-white/10 shadow-2xl shadow-black/50 rounded-2xl overflow-hidden backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95 transition-all ${loginError ? "shadow-red-900/20" : ""}`}>
                        {/* Top accent bar - muda de cor se tem erro */}
                        <div className={`h-1 w-full bg-gradient-to-r transition-all duration-500 ${loginError === "user_blocked" ? "from-red-500 via-red-400 to-red-600" : loginError ? "from-amber-500 via-amber-400 to-amber-600" : "from-blue-500 via-primary to-blue-400"}`}></div>

                        <CardHeader className="space-y-2 pb-6 pt-8 px-8 text-center">
                            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                                Acesso Restrito
                            </CardTitle>
                            <CardDescription className="text-sm text-zinc-600 dark:text-zinc-400">
                                Insira suas credenciais corporativas.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="px-8 pb-8">
                            {/* Inline Error Alert — aparece acima do formulário */}
                            {currentError && (
                                <div className={`mb-5 flex gap-3 rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${currentError.bg} ${currentError.border}`}>
                                    <currentError.icon className={`size-5 mt-0.5 shrink-0 ${currentError.color}`} />
                                    <div className="flex flex-col gap-0.5">
                                        <p className={`text-sm font-bold ${currentError.color}`}>{currentError.title}</p>
                                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{currentError.description}</p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="font-semibold text-zinc-700 dark:text-zinc-300">
                                        E-mail corporativo
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="seu.email@exemplo.com.br"
                                        required
                                        autoComplete="username"
                                        className={`h-11 bg-zinc-50 dark:bg-zinc-950/50 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 ${loginError ? "border-amber-300 dark:border-amber-700 focus:border-amber-400 focus:ring-amber-200/30" : "border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary/20"}`}
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setLoginError(null) }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="font-semibold text-zinc-700 dark:text-zinc-300">
                                            Senha
                                        </Label>
                                        <a href="#" className="text-sm font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 transition-colors">
                                            Esqueceu a senha?
                                        </a>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            className={`h-11 pr-10 bg-zinc-50 dark:bg-zinc-950/50 transition-all hover:bg-zinc-100 dark:hover:bg-zinc-900 ${loginError ? "border-amber-300 dark:border-amber-700 focus:border-amber-400 focus:ring-amber-200/30" : "border-zinc-200 dark:border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary/20"}`}
                                            value={senha}
                                            onChange={(e) => { setSenha(e.target.value); setLoginError(null) }}
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <Button
                                        type="submit"
                                        className={`w-full h-12 text-[15px] font-semibold tracking-wide gap-2 shadow-lg transition-all group hover:scale-[1.01] ${loginError === "user_blocked" ? "bg-red-600 hover:bg-red-700 shadow-red-900/30" : "shadow-primary/20"}`}
                                        disabled={isLoggingIn}
                                    >
                                        {isLoggingIn ? (
                                            <>
                                                <Loader2 className="size-5 animate-spin" />
                                                Verificando Sessão...
                                            </>
                                        ) : (
                                            <>
                                                Entrar no Painel
                                                <ArrowRight className="size-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>

                        <CardFooter className="flex flex-col gap-2 border-t border-zinc-200/50 dark:border-zinc-800/50 py-5 bg-zinc-50/50 dark:bg-zinc-900/30 px-8">
                            <p className="text-[11px] font-medium text-zinc-500 text-center tracking-wider uppercase">
                                Primardi © {new Date().getFullYear()}
                            </p>
                            <a
                                href="https://bitwiseagency.com.br/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-medium text-zinc-400 hover:text-primary transition-colors"
                            >
                                Desenvolvido por <span className="font-bold">Bitwise Agency</span>
                            </a>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    15% { transform: translateX(-6px); }
                    30% { transform: translateX(6px); }
                    45% { transform: translateX(-4px); }
                    60% { transform: translateX(4px); }
                    75% { transform: translateX(-2px); }
                    90% { transform: translateX(2px); }
                }
            `}</style>
        </div>
    )
}
