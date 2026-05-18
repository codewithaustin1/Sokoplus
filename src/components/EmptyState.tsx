import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionPath?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionPath,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[2rem] p-12 md:p-20 text-center border border-dashed border-gray-200 flex flex-col items-center justify-center space-y-6"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-orange-100 rounded-3xl blur-2xl opacity-50 scale-150 animate-pulse" />
        <div className="relative bg-orange-50 w-24 h-24 rounded-3xl flex items-center justify-center text-orange-600 shadow-sm rotate-3">
          <Icon size={48} />
        </div>
      </div>
      
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-black tracking-tight text-gray-900">{title}</h3>
        <p className="text-gray-500 font-medium leading-relaxed">{description}</p>
      </div>

      {(actionLabel && (actionPath || onAction)) && (
        <div className="pt-4">
          {actionPath ? (
            <Link
              to={actionPath}
              className="inline-flex items-center space-x-2 bg-gray-900 text-white px-10 py-5 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl hover:shadow-orange-200 group"
            >
              <span>{actionLabel}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center space-x-2 bg-gray-900 text-white px-10 py-5 rounded-2xl font-bold hover:bg-orange-600 transition-all shadow-xl hover:shadow-orange-200 group"
            >
              <span>{actionLabel}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
