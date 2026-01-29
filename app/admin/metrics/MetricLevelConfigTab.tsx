/**
 * Metric Level Config Tab Component
 * Manages MetricLevelConfig CRUD operations
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
import { BuildingRole, MetricType } from '@prisma/client';

type MetricLevelConfig = {
  id: string;
  buildingRole: BuildingRole;
  metricType: MetricType;
  level: number;
  minRequired: number;
  maxAllowed: number;
  effects: any;
  createdAt: Date;
  updatedAt: Date;
};

export default function MetricLevelConfigTab() {
  const [configs, setConfigs] = useState<MetricLevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MetricLevelConfig | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    buildingRole: 'HQ' as BuildingRole,
    metricType: 'SKU_COUNT' as MetricType,
    level: 1,
    minRequired: 0,
    maxAllowed: 0,
  });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/metrics/level-configs');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      buildingRole: 'HQ',
      metricType: 'SKU_COUNT',
      level: 1,
      minRequired: 0,
      maxAllowed: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (config: MetricLevelConfig) => {
    setEditingConfig(config);
    setFormData({
      buildingRole: config.buildingRole,
      metricType: config.metricType,
      level: config.level,
      minRequired: config.minRequired,
      maxAllowed: config.maxAllowed,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      buildingRole: formData.buildingRole,
      metricType: formData.metricType,
      level: parseInt(String(formData.level)),
      minRequired: parseInt(String(formData.minRequired)),
      maxAllowed: parseInt(String(formData.maxAllowed)),
    };

    try {
      const url = editingConfig
        ? `/api/admin/metrics/level-configs/${editingConfig.id}`
        : '/api/admin/metrics/level-configs';
      const method = editingConfig ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'Success', message: `Config ${editingConfig ? 'updated' : 'created'} successfully`, kind: 'success' });
        setDialogOpen(false);
        fetchConfigs();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to save config', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to save config', kind: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/metrics/level-configs/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Config deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchConfigs();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete config', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete config', kind: 'error' });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading configs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Metric Level Configs</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Config
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? 'Edit Metric Level Config' : 'Create Metric Level Config'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Building Role *</label>
                  <Select
                    value={formData.buildingRole}
                    onValueChange={(value) => setFormData({ ...formData, buildingRole: value as BuildingRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(BuildingRole).map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Metric Type *</label>
                  <Select
                    value={formData.metricType}
                    onValueChange={(value) => setFormData({ ...formData, metricType: value as MetricType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(MetricType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Level *</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Min Required</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.minRequired}
                    onChange={(e) => setFormData({ ...formData, minRequired: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Allowed *</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.maxAllowed}
                    onChange={(e) => setFormData({ ...formData, maxAllowed: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingConfig ? 'Update' : 'Create'}
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
              <TableHead>Building Role</TableHead>
              <TableHead>Metric Type</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Min Required</TableHead>
              <TableHead>Max Allowed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No configs found
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>{config.buildingRole}</TableCell>
                  <TableCell>{config.metricType}</TableCell>
                  <TableCell>{config.level}</TableCell>
                  <TableCell>{config.minRequired}</TableCell>
                  <TableCell>{config.maxAllowed}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(config.id);
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
              This action cannot be undone. This will permanently delete the metric level config.
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
