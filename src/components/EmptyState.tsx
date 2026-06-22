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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white dark:bg-gray-900 rounded-[2rem] p-12 md:p-20 text-center border border-dashed border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center space-y-6 transition-all"
    >
      <div className="relative">
        <div className="absolute inset-0 bg-orange-100 dark:bg-orange-950/20 rounded-3xl blur-2xl opacity-50 scale-150 animate-pulse" />
        <div className="relative bg-orange-50 dark:bg-orange-950/40 w-24 h-24 rounded-3xl flex items-center justify-center text-orange-600 dark:text-orange-400 shadow-sm rotate-3 border border-orange-100/30 dark:border-orange-900/30">
          <Icon size={48} />
        </div>
      </div>
      
      <div className="space-y-2 max-w-md">
        <h3 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{description}</p>
      </div>

      {(actionLabel && (actionPath || onAction)) && (
        <div className="pt-4">
          {actionPath ? (
            <Link
              to={actionPath}
              className="inline-flex items-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-gray-950 px-10 py-4.5 rounded-full font-bold hover:bg-orange-600 dark:hover:bg-orange-500 dark:hover:text-white transition-all shadow-xl hover:shadow-orange-200/50 dark:hover:shadow-none group active:scale-95 duration-155"
            >
              <span>{actionLabel}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center space-x-2 bg-gray-900 dark:bg-white text-white dark:text-gray-950 px-10 py-4.5 rounded-full font-bold hover:bg-orange-600 dark:hover:bg-orange-500 dark:hover:text-white transition-all shadow-xl hover:shadow-orange-200/50 dark:hover:shadow-none group active:scale-95 duration-155"
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
