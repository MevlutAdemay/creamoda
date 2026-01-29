/**
 * Equipment Catalog Tab Component
 * Manages EquipmentCatalog CRUD operations
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/ToastCenter';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { BuildingRole } from '@prisma/client';

type EquipmentCatalog = {
  id: string;
  code: string;
  name: string;
  allowedBuildingRole: BuildingRole | null;
  purchaseCostMoney: number;
  monthlyMaintenanceCost: number;
  effects: any;
  createdAt: Date;
  updatedAt: Date;
};

export default function EquipmentCatalogTab() {
  const [equipment, setEquipment] = useState<EquipmentCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentCatalog | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    allowedBuildingRole: '__none__' as BuildingRole | '__none__',
    purchaseCostMoney: 0,
    monthlyMaintenanceCost: 0,
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/admin/metrics/equipment-catalog');
      if (res.ok) {
        const data = await res.json();
        setEquipment(data.equipment || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEquipment(null);
    setFormData({
      code: '',
      name: '',
      allowedBuildingRole: '__none__',
      purchaseCostMoney: 0,
      monthlyMaintenanceCost: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: EquipmentCatalog) => {
    setEditingEquipment(item);
    setFormData({
      code: item.code,
      name: item.name,
      allowedBuildingRole: item.allowedBuildingRole || '__none__',
      purchaseCostMoney: item.purchaseCostMoney,
      monthlyMaintenanceCost: item.monthlyMaintenanceCost,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      code: formData.code,
      name: formData.name,
      allowedBuildingRole: formData.allowedBuildingRole === '__none__' ? null : formData.allowedBuildingRole,
      purchaseCostMoney: parseInt(String(formData.purchaseCostMoney)),
      monthlyMaintenanceCost: parseInt(String(formData.monthlyMaintenanceCost)),
    };

    try {
      const url = editingEquipment
        ? `/api/admin/metrics/equipment-catalog/${editingEquipment.id}`
        : '/api/admin/metrics/equipment-catalog';
      const method = editingEquipment ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'Success', message: `Equipment ${editingEquipment ? 'updated' : 'created'} successfully`, kind: 'success' });
        setDialogOpen(false);
        fetchEquipment();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to save equipment', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to save equipment', kind: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/metrics/equipment-catalog/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Equipment deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchEquipment();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete equipment', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete equipment', kind: 'error' });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading equipment...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Equipment Catalog</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEquipment ? 'Edit Equipment' : 'Create Equipment'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code * (unique)</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Allowed Building Role (optional)</label>
                <Select
                  value={formData.allowedBuildingRole}
                  onValueChange={(value) => setFormData({ ...formData, allowedBuildingRole: value as BuildingRole | '__none__' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (All Buildings)</SelectItem>
                    {Object.values(BuildingRole).map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Purchase Cost Money</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.purchaseCostMoney}
                    onChange={(e) => setFormData({ ...formData, purchaseCostMoney: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Monthly Maintenance Cost</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.monthlyMaintenanceCost}
                    onChange={(e) => setFormData({ ...formData, monthlyMaintenanceCost: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingEquipment ? 'Update' : 'Create'}
                </Button>
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
              <TableHead>Name</TableHead>
              <TableHead>Allowed Building Role</TableHead>
              <TableHead>Purchase Cost</TableHead>
              <TableHead>Monthly Maintenance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No equipment found
                </TableCell>
              </TableRow>
            ) : (
              equipment.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.allowedBuildingRole || 'All'}</TableCell>
                  <TableCell>{item.purchaseCostMoney}</TableCell>
                  <TableCell>{item.monthlyMaintenanceCost}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(item.id);
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the equipment catalog item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
