//components/admin/products/CategoryPickerDialog.tsx

/**
 * Category Picker Dialog
 * Searchable table for selecting L3 categories
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw } from 'lucide-react';

type CategoryData = {
  id: string;
  code: string;
  name: string;
  slug: string;
  manufacturingGroup: string | null;
  defaultShippingProfile: string | null;
  pathLabel: string;
};

type CategoryPickerDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSelect: (category: {
    id: string;
    pathLabel: string;
    code: string;
    name: string;
  }) => void;
  selectedId?: string;
};

export default function CategoryPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedId,
}: CategoryPickerDialogProps) {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open]);

  const fetchCategories = async (query?: string) => {
    setLoading(true);
    try {
      const url = query
        ? `/api/admin/products/categories/picker?level=L3&query=${encodeURIComponent(query)}`
        : '/api/admin/products/categories/picker?level=L3';
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchCategories(searchQuery);
  };

  const handleRefresh = () => {
    setSearchQuery('');
    fetchCategories();
  };

  const handleRowClick = (category: CategoryData) => {
    onSelect({
      id: category.id,
      pathLabel: category.pathLabel,
      code: category.code,
      name: category.name,
    });
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Category</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, name, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button onClick={handleRefresh} variant="outline" disabled={loading}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Loading...
            </div>
          ) : categories.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No L3 categories found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Shipping</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow
                    key={category.id}
                    onClick={() => handleRowClick(category)}
                    className={`cursor-pointer hover:bg-accent ${
                      selectedId === category.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <TableCell className="font-medium">{category.pathLabel}</TableCell>
                    <TableCell>{category.code}</TableCell>
                    <TableCell>{category.name}</TableCell>
                    <TableCell>{category.manufacturingGroup || '-'}</TableCell>
                    <TableCell>{category.defaultShippingProfile || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
