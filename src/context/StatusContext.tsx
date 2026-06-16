import { type ReactNode } from "react";
import toast, { Toaster } from "react-hot-toast";
import type { StatusType } from "../types";

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <line x1="12" y1="8" x2="12" y2="8" />
      <line x1="12" y1="11" x2="12" y2="16" />
    </svg>
  );
}

const VARIANTS: Record<
  StatusType,
  {
    border: string;
    text: string;
    iconBg: string;
    iconColor: string;
    icon: ReactNode;
  }
> = {
  success: {
    border: "#2fae5f",
    text: "#54d189",
    iconBg: "#1f7a44",
    iconColor: "#ffffff",
    icon: <CheckIcon />,
  },
  error: {
    border: "#e05a5a",
    text: "#ef7a7a",
    iconBg: "#6e2b2b",
    iconColor: "#f3a6a6",
    icon: <XIcon />,
  },
  info: {
    border: "#F5BC27",
    text: "#F5BC27",
    iconBg: "#5a4514",
    iconColor: "#ffd35c",
    icon: <InfoIcon />,
  },
};

function ToastCard({
  type,
  message,
  visible,
}: {
  type: StatusType;
  message: ReactNode;
  visible: boolean;
}) {
  const v = VARIANTS[type];
  return (
    <div
      style={{ borderColor: v.border, color: v.text, opacity: visible ? 1 : 0 }}
      className="flex min-w-[260px] max-w-[440px] items-center gap-3 rounded-2xl border bg-[#141414] px-4 py-3 shadow-lg transition-all duration-200"
    >
      <span
        style={{ background: v.iconBg, color: v.iconColor }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      >
        {v.icon}
      </span>
      <span className="text-[0.95rem] font-medium leading-snug">{message}</span>
    </div>
  );
}

/** Show a toast notification (kept name-compatible with the old API). */
export function showStatus(message: ReactNode, type: StatusType = "info") {
  const duration = type === "success" ? 6000 : type === "error" ? 6000 : 3000;
  toast.custom(
    (t) => <ToastCard type={type} message={message} visible={t.visible} />,
    {
      duration,
    },
  );
}

/** Dismiss all toasts. */
export function hideStatus() {
  toast.dismiss();
}

export function useStatus() {
  return { showStatus, hideStatus };
}

/** Mounts the toast container. Keeps the original provider name/structure. */
export function StatusProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        gutter={12}
        containerStyle={{ top: 24, right: 24 }}
      />
    </>
  );
}
