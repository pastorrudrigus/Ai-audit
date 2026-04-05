"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alerts">
            <Bell className="w-4 h-4" />
          </Link>
        </Button>
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
