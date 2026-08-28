import { useAuth } from "@/_core/hooks/useAuth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Account() {
  const { user } = useAuth();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md pb-12">
        <div className="border-b-2 border-black pb-5">
          <h1 className="text-3xl font-black tracking-[-0.07em] sm:text-4xl">Conta</h1>
          <p className="mt-2 text-xs text-neutral-500">{user?.username ?? user?.name}</p>
        </div>

        <div className="mt-8 border border-black p-5">
          <p className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Mudar palavra-passe</p>
          <ChangePasswordForm onSuccess={() => toast.success("Palavra-passe atualizada. As outras sessões abertas foram terminadas.")} />
        </div>
      </div>
    </DashboardLayout>
  );
}
