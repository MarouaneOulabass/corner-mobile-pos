'use client';

interface StockStatsProps {
  total: number;
}

export default function StockStats({ total }: StockStatsProps) {
  return (
    <p className="text-xs text-gray-400 mb-2">
      {total} produit{total !== 1 ? 's' : ''}
    </p>
  );
}
