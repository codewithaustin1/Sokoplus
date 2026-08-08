import React from "react";
import { Check, X, Shield, ShieldAlert, ShieldCheck } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
  language?: "en" | "sw";
}

export interface PasswordCriteria {
  hasMinLength: boolean;
  hasUpperLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  score: number; // 0 to 4
}

export function getPasswordCriteria(password: string): PasswordCriteria {
  const hasMinLength = password.length >= 8;
  const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasUpperLower) score++;
  if (hasNumber) score++;
  if (hasSymbol) score++;

  return {
    hasMinLength,
    hasUpperLower,
    hasNumber,
    hasSymbol,
    score,
  };
}

export default function PasswordStrengthIndicator({
  password,
  showRequirements = true,
  language = "en",
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const criteria = getPasswordCriteria(password);
  const { hasMinLength, hasUpperLower, hasNumber, hasSymbol, score } = criteria;

  const isSwahili = language === "sw";

  const getStrengthMeta = () => {
    switch (score) {
      case 1:
        return {
          label: isSwahili ? "Dhaifu" : "Weak",
          color: "bg-red-500",
          textColor: "text-red-600 dark:text-red-400",
          percent: 25,
          icon: ShieldAlert,
        };
      case 2:
        return {
          label: isSwahili ? "Kiasi" : "Fair",
          color: "bg-amber-500",
          textColor: "text-amber-600 dark:text-amber-400",
          percent: 50,
          icon: Shield,
        };
      case 3:
        return {
          label: isSwahili ? "Imara" : "Strong",
          color: "bg-emerald-500",
          textColor: "text-emerald-600 dark:text-emerald-400",
          percent: 75,
          icon: ShieldCheck,
        };
      case 4:
        return {
          label: isSwahili ? "Imara Sana" : "Very Strong",
          color: "bg-green-600",
          textColor: "text-green-600 dark:text-green-400",
          percent: 100,
          icon: ShieldCheck,
        };
      default:
        return {
          label: isSwahili ? "Dhaifu Mno" : "Very Weak",
          color: "bg-red-400",
          textColor: "text-red-500 dark:text-red-400",
          percent: 10,
          icon: ShieldAlert,
        };
    }
  };

  const meta = getStrengthMeta();
  const IconComponent = meta.icon;

  const requirements = [
    {
      met: hasMinLength,
      label: isSwahili ? "Angalau herufi 8" : "At least 8 characters",
    },
    {
      met: hasUpperLower,
      label: isSwahili ? "Herufi kubwa na ndogo" : "Upper & lowercase letters",
    },
    {
      met: hasNumber,
      label: isSwahili ? "Angalau nambari 1" : "At least 1 number",
    },
    {
      met: hasSymbol,
      label: isSwahili ? "Angalau alama 1 (!@#$)" : "At least 1 special symbol (!@#$)",
    },
  ];

  return (
    <div className="space-y-2.5 pt-1.5 animate-fade-in">
      {/* Strength Header & Multi-segment Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-extrabold">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <IconComponent size={14} className={meta.textColor} />
            <span>{isSwahili ? "Nguvu ya Nenosiri:" : "Password Strength:"}</span>
          </div>
          <span className={`uppercase tracking-wider ${meta.textColor}`}>
            {meta.label}
          </span>
        </div>

        {/* 4 Segment Progress Indicator */}
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-full rounded-full transition-all duration-300 ${
                step <= score
                  ? meta.color
                  : "bg-gray-200 dark:bg-gray-800"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {requirements.map((req, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                req.met
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] ${
                  req.met
                    ? "bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                }`}
              >
                {req.met ? <Check size={10} className="stroke-[3]" /> : <X size={9} />}
              </div>
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
