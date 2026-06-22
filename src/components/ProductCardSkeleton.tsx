import { motion } from "motion/react";

export default function ProductCardSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-pulse select-none">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-4 shadow-sm flex flex-col justify-between h-full relative"
        >
          {/* Shimmering Image Area */}
          <div className="aspect-square bg-gray-100 dark:bg-gray-950 rounded-2xl overflow-hidden relative mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/40 dark:via-gray-800/40 to-transparent -translate-x-full animate-shimmer" />
            
            {/* Top Badge placeholder */}
            <div className="absolute top-2 right-2 w-16 h-4 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="absolute top-2 left-2 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>

          {/* Details Placeholder */}
          <div className="space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              {/* Stars Row placeholder */}
              <div className="flex items-center space-x-1">
                <div className="w-12 h-3.5 bg-gray-200 dark:bg-gray-800 rounded-md" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-800 rounded-md" />
              </div>
              
              {/* Product name lines placeholder */}
              <div className="w-11/12 h-5 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              <div className="w-3/4 h-3.5 bg-gray-100 dark:bg-gray-850 rounded-lg" />
            </div>

            {/* Price & Action row placeholder */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-1">
                <div className="w-16 h-6 bg-gray-200 dark:bg-gray-800 rounded-md" />
                <div className="w-10 h-3 bg-gray-100 dark:bg-gray-850 rounded-md" />
              </div>
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
