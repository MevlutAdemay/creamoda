/**
 * Requirement Rule Tab Component
 * Manages RequirementRule CRUD operations
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { BuildingRole, MetricType } from '@prisma/client';

type EquipmentCatalog = {
  id: string;
  code: string;
  name: string;
};

type RequirementEquipment = {
  id: string;
  equipmentId: string;
  requiredQuantity: number;
  equipment: EquipmentCatalog;
};

type RequirementRule = {
  id: string;
  buildingRole: BuildingRole;
  metricType: MetricType;
  level: number;
  requiresStaffingComplete: boolean;
  effects: any;
  equipmentRequirements: RequirementEquipment[];
  createdAt: Date;
  updatedAt: Date;
};

type EquipmentRequirementForm = {
  equipmentId: string;
  requiredQuantity: number;
};

export default function RequirementRuleTab() {
  const [rules, setRules] = useState<RequirementRule[]>([]);
  const [equipmentList, setEquipmentList] = useState<EquipmentCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RequirementRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    buildingRole: 'HQ' as BuildingRole,
    metricType: 'SKU_COUNT' as MetricType,
    level: 1,
    requiresStaffingComplete: true,
    equipmentRequirements: [] as EquipmentRequirementForm[],
  });

  useEffect(() => {
    fetchRules();
    fetchEquipment();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/admin/metrics/requirement-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/admin/metrics/equipment-catalog');
      if (res.ok) {
        const data = await res.json();
        setEquipmentList(data.equipment || []);
      }
    } catch (error) {
      console.error('Error fetching equipment:', error);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      buildingRole: 'HQ',
      metricType: 'SKU_COUNT',
      level: 1,
      requiresStaffingComplete: true,
      equipmentRequirements: [],
    });
    setDialogOpen(true);
  };

  const handleEdit = (rule: RequirementRule) => {
    setEditingRule(rule);
    setFormData({
      buildingRole: rule.buildingRole,
      metricType: rule.metricType,
      level: rule.level,
      requiresStaffingComplete: rule.requiresStaffingComplete,
      equipmentRequirements: rule.equipmentRequirements.map((eqReq) => ({
        equipmentId: eqReq.equipmentId,
        requiredQuantity: eqReq.requiredQuantity,
      })),
    });
    setDialogOpen(true);
  };

  const addEquipmentRequirement = () => {
    setFormData({
      ...formData,
      equipmentRequirements: [
        ...formData.equipmentRequirements,
        { equipmentId: '', requiredQuantity: 1 },
      ],
    });
  };

  const removeEquipmentRequirement = (index: number) => {
    setFormData({
      ...formData,
      equipmentRequirements: formData.equipmentRequirements.filter((_, i) => i !== index),
    });
  };

  const updateEquipmentRequirement = (index: number, field: 'equipmentId' | 'requiredQuantity', value: string | number) => {
    const updated = [...formData.equipmentRequirements];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, equipmentRequirements: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty equipment requirements
    const validEquipmentRequirements = formData.equipmentRequirements.filter(
      (eqReq) => eqReq.equipmentId && eqReq.requiredQuantity > 0
    );

    const payload: any = {
      buildingRole: formData.buildingRole,
      metricType: formData.metricType,
      level: parseInt(String(formData.level)),
      requiresStaffingComplete: formData.requiresStaffingComplete,
      equipmentRequirements: validEquipmentRequirements.length > 0 ? validEquipmentRequirements : [],
    };

    try {
      const url = editingRule
        ? `/api/admin/metrics/requirement-rules/${editingRule.id}`
        : '/api/admin/metrics/requirement-rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'Success', message: `Rule ${editingRule ? 'updated' : 'created'} successfully`, kind: 'success' });
        setDialogOpen(false);
        fetchRules();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to save rule', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to save rule', kind: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/metrics/requirement-rules/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Rule deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchRules();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete rule', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete rule', kind: 'error' });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Requirement Rules</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Requirement Rule' : 'Create Requirement Rule'}
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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="flex items-center space-x-2 pt-8">
                  <Checkbox
                    id="requiresStaffingComplete"
                    checked={formData.requiresStaffingComplete}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, requiresStaffingComplete: checked === true })
                    }
                  />
                  <label htmlFor="requiresStaffingComplete" className="text-sm font-medium cursor-pointer">
                    Requires Staffing Complete
                  </label>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">Equipment Requirements</label>
                  <Button type="button" variant="outline" size="sm" onClick={addEquipmentRequirement}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Equipment
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.equipmentRequirements.map((eqReq, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select
                        value={eqReq.equipmentId}
                        onValueChange={(value) => updateEquipmentRequirement(index, 'equipmentId', value)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select equipment" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentList.map((equipment) => (
                            <SelectItem key={equipment.id} value={equipment.id}>
                              {equipment.code} - {equipment.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={eqReq.requiredQuantity}
                        onChange={(e) =>
                          updateEquipmentRequirement(index, 'requiredQuantity', parseInt(e.target.value) || 1)
                        }
                        className="w-24"
                        placeholder="Qty"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEquipmentRequirement(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {formData.equipmentRequirements.length === 0 && (
                    <p className="text-sm text-muted-foreground">No equipment requirements added</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingRule ? 'Update' : 'Create'}
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
              <TableHead>Requires Staffing</TableHead>
              <TableHead>Equipment Requirements</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No rules found
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.buildingRole}</TableCell>
                  <TableCell>{rule.metricType}</TableCell>
                  <TableCell>{rule.level}</TableCell>
                  <TableCell>{rule.requiresStaffingComplete ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    {rule.equipmentRequirements.length > 0 ? (
                      <div className="space-y-1">
                        {rule.equipmentRequirements.map((eqReq) => (
                          <div key={eqReq.id} className="text-sm">
                            {eqReq.equipment.code} × {eqReq.requiredQuantity}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(rule)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(rule.id);
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
              This action cannot be undone. This will permanently delete the requirement rule and all its equipment requirements.
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
