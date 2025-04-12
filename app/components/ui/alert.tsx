import { ReactNode } from "react";

interface AlertProps {
  children: ReactNode;
  variant?: "error" | "success" | "warning" | "info";
  className?: string;
}

export function Alert({
  children,
  variant = "info",
  className = "",
}: AlertProps) {
  const variantStyles = {
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div
      className={`p-4 mb-4 rounded-md border ${variantStyles[variant]} ${className}`}
    >
      <div className="flex">
        {variant === "error" && (
          <svg
            className="h-5 w-5 text-red-500 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )}
        <p>{children}</p>
      </div>
    </div>
  );
}
