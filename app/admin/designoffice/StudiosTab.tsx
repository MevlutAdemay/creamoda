// app/admin/designoffice/StudiosTab.tsx

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/ToastCenter';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ProductSeason, StyleTag, ProductQuality, StudioStatus } from '@prisma/client';
import { ImageUploadButton } from '@/components/admin/designoffice/ImageUploadButton';
import Image from 'next/image';

type DesignStudio = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  shortPitch: string | null;
  productSeason: ProductSeason;
  styleTag: StyleTag;
  quality: ProductQuality;
  status: StudioStatus;
  coverImageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count: {
    items: number;
  };
};

export default function StudiosTab() {
  const [studios, setStudios] = useState<DesignStudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudio, setEditingStudio] = useState<DesignStudio | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    shortPitch: '',
    productSeason: 'WINTER' as ProductSeason,
    styleTag: 'CASUAL' as StyleTag,
    quality: 'STANDARD' as ProductQuality,
    status: 'DRAFT' as StudioStatus,
    coverImageUrl: '',
    sortOrder: '0',
  });

  useEffect(() => {
    fetchStudios();
  }, []);

  const fetchStudios = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/design-studios');
      if (res.ok) {
        const data = await res.json();
        setStudios(data.studios || []);
      }
    } catch (error) {
      console.error('Error fetching studios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingStudio(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      shortPitch: '',
      productSeason: 'WINTER',
      styleTag: 'CASUAL',
      quality: 'STANDARD',
      status: 'DRAFT',
      coverImageUrl: '',
      sortOrder: '0',
    });
    setDialogOpen(true);
  };

  const handleEdit = (studio: DesignStudio) => {
    setEditingStudio(studio);
    setFormData({
      code: studio.code,
      title: studio.title,
      description: studio.description || '',
      shortPitch: studio.shortPitch || '',
      productSeason: studio.productSeason,
      styleTag: studio.styleTag,
      quality: studio.quality,
      status: studio.status,
      coverImageUrl: studio.coverImageUrl || '',
      sortOrder: studio.sortOrder.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingStudio
        ? `/api/admin/design-studios/${editingStudio.id}`
        : '/api/admin/design-studios';
      const method = editingStudio ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sortOrder: parseInt(formData.sortOrder) || 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          message: `Design studio ${editingStudio ? 'updated' : 'created'} successfully`,
          kind: 'success',
        });
        setDialogOpen(false);
        fetchStudios();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          message: data.error || 'Failed to save design studio',
          kind: 'error',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        message: 'Failed to save design studio',
        kind: 'error',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/design-studios/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Success',
          message: 'Design studio deleted successfully',
          kind: 'success',
        });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchStudios();
      } else {
        const data = await res.json();
        toast({
          title: 'Error',
          message: data.error || 'Failed to delete design studio',
          kind: 'error',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        message: 'Failed to delete design studio',
        kind: 'error',
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading studios...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Design Studios</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Studio
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStudio ? 'Edit Design Studio' : 'Create Design Studio'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code *</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Short Pitch</label>
                <Textarea
                  value={formData.shortPitch}
                  onChange={(e) => setFormData({ ...formData, shortPitch: e.target.value })}
                  placeholder="Short studio pitch for card preview (e.g., 'CasualWear Giyim Tarzı için çok çeşit bulacağınız tasarım ofisini ziyaret ediniz.')"
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This text will be displayed on the office card. If left empty, a default description will be generated.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Season *</label>
                  <Select
                    value={formData.productSeason}
                    onValueChange={(value) =>
                      setFormData({ ...formData, productSeason: value as ProductSeason })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ProductSeason).map((season) => (
                        <SelectItem key={season} value={season}>
                          {season}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Style Tag *</label>
                  <Select
                    value={formData.styleTag}
                    onValueChange={(value) =>
                      setFormData({ ...formData, styleTag: value as StyleTag })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(StyleTag).map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Quality *</label>
                  <Select
                    value={formData.quality}
                    onValueChange={(value) =>
                      setFormData({ ...formData, quality: value as ProductQuality })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ProductQuality).map((q) => (
                        <SelectItem key={q} value={q}>
                          {q}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as StudioStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(StudioStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Sort Order</label>
                  <Input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Cover Image</label>
                <ImageUploadButton
                  currentImageUrl={formData.coverImageUrl}
                  onImageUploaded={(url) => setFormData({ ...formData, coverImageUrl: url })}
                  studioTitle={formData.title}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Cover Image</TableHead>
              <TableHead>Season</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Sort</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No design studios found
                </TableCell>
              </TableRow>
            ) : (
              studios.map((studio) => (
                <TableRow key={studio.id}>
                  <TableCell className="font-mono text-sm">{studio.code}</TableCell>
                  <TableCell>{studio.title}</TableCell>
                  <TableCell>
                    <div className="w-24">
                      <ImageUploadButton
                        compact
                        currentImageUrl={studio.coverImageUrl}
                        onImageUploaded={async (url) => {
                          // Update studio cover image inline
                          try {
                            const res = await fetch(`/api/admin/design-studios/${studio.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ coverImageUrl: url }),
                            });
                            if (res.ok) {
                              toast({
                                title: 'Success',
                                message: 'Cover image updated',
                                kind: 'success',
                              });
                              fetchStudios();
                            } else {
                              throw new Error('Update failed');
                            }
                          } catch (error) {
                            toast({
                              title: 'Error',
                              message: 'Failed to update cover image',
                              kind: 'error',
                            });
                          }
                        }}
                        studioId={studio.id}
                        studioTitle={studio.title}
                      />
                    </div>
                  </TableCell>
                  <TableCell>{studio.productSeason}</TableCell>
                  <TableCell>{studio.styleTag}</TableCell>
                  <TableCell>{studio.quality}</TableCell>
                  <TableCell>{studio.status}</TableCell>
                  <TableCell>{studio._count.items}</TableCell>
                  <TableCell>{studio.sortOrder}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(studio)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(studio.id);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Design Studio</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this design studio? This will also delete all items in this studio. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
