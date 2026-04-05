import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">AIGate</h1>
          <p className="text-slate-500 mt-2">Crie sua conta</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
