export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="animate-pulse">
        {/* Table Header */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex space-x-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-24"></div>
            ))}
          </div>
        </div>
        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex space-x-4">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded w-32"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-6 w-6 bg-gray-200 rounded"></div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TabSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 rounded"></div>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </div>
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg shadow animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
      <div className="h-64 bg-gray-100 rounded"></div>
    </div>
  );
}
