/**
 * Images Tab Component
 * Manages ProductImageTemplate CRUD operations with blob upload
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/ToastCenter';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ProductImageSlot, ProductImageUnlockType } from '@prisma/client';
// Using regular img tag for external blob URLs

type ProductImage = {
  id: string;
  slot: ProductImageSlot;
  url: string;
  alt: string | null;
  unlockType: ProductImageUnlockType;
  unlockCostXp: number | null;
  unlockCostDiamond: number | null;
  sortOrder: number;
  updatedAt: string;
  meta: any;
};

type Template = {
  id: string;
  code: string;
  name: string;
};

export default function ImagesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<ProductImage | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    slot: 'MAIN' as ProductImageSlot,
    unlockType: 'ALWAYS' as ProductImageUnlockType,
    unlockCostXp: '',
    unlockCostDiamond: '',
    sortOrder: '0',
    alt: '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      fetchImages();
    } else {
      setImages([]);
    }
  }, [selectedTemplateId]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/products/templates?take=1000');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchImages = async () => {
    if (!selectedTemplateId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/images?productTemplateId=${selectedTemplateId}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingImage(null);
    setFormData({
      slot: 'MAIN',
      unlockType: 'ALWAYS',
      unlockCostXp: '',
      unlockCostDiamond: '',
      sortOrder: '0',
      alt: '',
      file: null,
    });
    setDialogOpen(true);
  };

  const handleEdit = (image: ProductImage) => {
    setEditingImage(image);
    setFormData({
      slot: image.slot,
      unlockType: image.unlockType,
      unlockCostXp: image.unlockCostXp?.toString() || '',
      unlockCostDiamond: image.unlockCostDiamond?.toString() || '',
      sortOrder: image.sortOrder.toString(),
      alt: image.alt || '',
      file: null, // Don't allow changing file
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let imageUrl = editingImage?.url;

      // Upload file if creating new or file is selected
      if (!editingImage && formData.file) {
        setUploading(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.file);
        uploadFormData.append('folder', 'products');
        uploadFormData.append('filenameBase', selectedTemplateId);

        const uploadRes = await fetch('/api/admin/blob/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;

        // Create meta
        const meta = {
          originalFileName: formData.file.name,
          uploadedAt: new Date().toISOString(),
          width: uploadData.width,
          height: uploadData.height,
          format: 'webp',
          transparent: true,
        };

        // Create image record
        const createRes = await fetch('/api/admin/products/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productTemplateId: selectedTemplateId,
            slot: formData.slot,
            url: imageUrl,
            alt: formData.alt || null,
            unlockType: formData.unlockType,
            unlockCostXp: formData.unlockCostXp ? parseInt(formData.unlockCostXp) : null,
            unlockCostDiamond: formData.unlockCostDiamond ? parseInt(formData.unlockCostDiamond) : null,
            sortOrder: parseInt(formData.sortOrder),
            meta,
          }),
        });

        if (createRes.ok) {
          toast({ title: 'Success', message: 'Image uploaded and created successfully', kind: 'success' });
          setDialogOpen(false);
          fetchImages();
        } else {
          const errorData = await createRes.json();
          throw new Error(errorData.error || 'Failed to create image record');
        }
      } else if (editingImage) {
        // Update existing (no file upload)
        const updateRes = await fetch(`/api/admin/products/images/${editingImage.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slot: formData.slot,
            unlockType: formData.unlockType,
            unlockCostXp: formData.unlockCostXp ? parseInt(formData.unlockCostXp) : null,
            unlockCostDiamond: formData.unlockCostDiamond ? parseInt(formData.unlockCostDiamond) : null,
            sortOrder: parseInt(formData.sortOrder),
            alt: formData.alt || null,
          }),
        });

        if (updateRes.ok) {
          toast({ title: 'Success', message: 'Image updated successfully', kind: 'success' });
          setDialogOpen(false);
          fetchImages();
        } else {
          const errorData = await updateRes.json();
          throw new Error(errorData.error || 'Failed to update image');
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to save image', kind: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products/images/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Image deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchImages();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete image', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete image', kind: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Images</h2>
      </div>

      <div className="flex gap-4">
        <div className="w-64">
          <label className="text-sm font-medium mb-2 block">Select Product Template</label>
          <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.code} - {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplateId && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Image
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingImage ? 'Edit Image' : 'Add Image'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingImage && (
                  <div>
                    <label className="text-sm font-medium">Image File *</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({ ...formData, file });
                        }
                      }}
                      required={!editingImage}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Slot *</label>
                    <Select
                      value={formData.slot}
                      onValueChange={(value) => setFormData({ ...formData, slot: value as ProductImageSlot })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ProductImageSlot).map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unlock Type *</label>
                    <Select
                      value={formData.unlockType}
                      onValueChange={(value) => setFormData({ ...formData, unlockType: value as ProductImageUnlockType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ProductImageUnlockType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Unlock Cost (XP)</label>
                    <Input
                      type="number"
                      value={formData.unlockCostXp}
                      onChange={(e) => setFormData({ ...formData, unlockCostXp: e.target.value })}
                      placeholder="Leave empty for none"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Unlock Cost (Diamond)</label>
                    <Input
                      type="number"
                      value={formData.unlockCostDiamond}
                      onChange={(e) => setFormData({ ...formData, unlockCostDiamond: e.target.value })}
                      placeholder="Leave empty for none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Sort Order</label>
                    <Input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Alt Text</label>
                    <Input
                      value={formData.alt}
                      onChange={(e) => setFormData({ ...formData, alt: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={uploading}>
                    {uploading ? 'Uploading...' : editingImage ? 'Update' : 'Upload & Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedTemplateId && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <ModaVerseLogoLoader size={40} className="text-primary" />
              <span className="text-muted-foreground">Loading images...</span>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thumbnail</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Unlock Type</TableHead>
                    <TableHead>XP Cost</TableHead>
                    <TableHead>Diamond Cost</TableHead>
                    <TableHead>Sort Order</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {images.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No images found for this template
                      </TableCell>
                    </TableRow>
                  ) : (
                    images.map((image) => (
                      <TableRow key={image.id}>
                        <TableCell>
                          <div className="w-24 h-24 relative overflow-hidden rounded bg-muted">
                            <img
                              src={image.url}
                              alt={image.alt || 'Product image'}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        </TableCell>
                        <TableCell>{image.slot}</TableCell>
                        <TableCell>
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline truncate max-w-xs block"
                          >
                            {image.url}
                          </a>
                        </TableCell>
                        <TableCell>{image.unlockType}</TableCell>
                        <TableCell>{image.unlockCostXp || '-'}</TableCell>
                        <TableCell>{image.unlockCostDiamond || '-'}</TableCell>
                        <TableCell>{image.sortOrder}</TableCell>
                        <TableCell>{new Date(image.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(image)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingId(image.id);
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
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this image record? The blob file will NOT be deleted.
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
