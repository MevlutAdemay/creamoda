// app/admin/metrics/StaffingRuleTab.tsx
/**
 * Staffing Rule Tab Component
 * Manages StaffingRule CRUD operations
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
import { BuildingRole, MetricType, DepartmentCode, StaffRoleStyle } from '@prisma/client';

type StaffingRule = {
  id: string;
  buildingRole: BuildingRole;
  metricType: MetricType;
  level: number;
  departmentCode: DepartmentCode;
  roleStyle: StaffRoleStyle;
  roleCode: string;
  roleName: string;
  deltaHeadcount: number;
  baseMonthlySalary: number;
  effects: any;
  createdAt: Date;
  updatedAt: Date;
};

export default function StaffingRuleTab() {
  const [rules, setRules] = useState<StaffingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StaffingRule | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    buildingRole: 'HQ' as BuildingRole,
    metricType: 'SKU_COUNT' as MetricType,
    level: 1,
    departmentCode: 'TOP_MANAGEMENT' as DepartmentCode,
    roleStyle: 'EMPLOYEE' as StaffRoleStyle,
    roleCode: '',
    roleName: '',
    deltaHeadcount: 0,
    baseMonthlySalary: 0,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/admin/metrics/staffing-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setFormData({
      buildingRole: 'HQ',
      metricType: 'SKU_COUNT',
      level: 1,
      departmentCode: 'TOP_MANAGEMENT',
      roleStyle: 'EMPLOYEE',
      roleCode: '',
      roleName: '',
      deltaHeadcount: 0,
      baseMonthlySalary: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (rule: StaffingRule) => {
    setEditingRule(rule);
    setFormData({
      buildingRole: rule.buildingRole,
      metricType: rule.metricType,
      level: rule.level,
      departmentCode: rule.departmentCode,
      roleStyle: rule.roleStyle,
      roleCode: rule.roleCode,
      roleName: rule.roleName,
      deltaHeadcount: rule.deltaHeadcount,
      baseMonthlySalary: typeof rule.baseMonthlySalary === 'number' ? rule.baseMonthlySalary : parseFloat(String(rule.baseMonthlySalary)) || 0,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = {
      buildingRole: formData.buildingRole,
      metricType: formData.metricType,
      level: parseInt(String(formData.level)),
      departmentCode: formData.departmentCode,
      roleStyle: formData.roleStyle,
      roleCode: formData.roleCode,
      roleName: formData.roleName,
      deltaHeadcount: parseInt(String(formData.deltaHeadcount)),
      baseMonthlySalary: parseFloat(String(formData.baseMonthlySalary)),
    };

    try {
      const url = editingRule
        ? `/api/admin/metrics/staffing-rules/${editingRule.id}`
        : '/api/admin/metrics/staffing-rules';
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
      const res = await fetch(`/api/admin/metrics/staffing-rules/${id}`, {
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
        <h2 className="text-2xl font-semibold">Staffing Rules</h2>
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
                {editingRule ? 'Edit Staffing Rule' : 'Create Staffing Rule'}
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
                  <label className="text-sm font-medium">Department Code *</label>
                  <Select
                    value={formData.departmentCode}
                    onValueChange={(value) => setFormData({ ...formData, departmentCode: value as DepartmentCode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DepartmentCode).map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
             
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Delta Headcount *</label>
                  <Input
                    type="number"
                    value={formData.deltaHeadcount}
                    onChange={(e) => setFormData({ ...formData, deltaHeadcount: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role Style *</label>
                  <Select
                    value={formData.roleStyle}
                    onValueChange={(value) => setFormData({ ...formData, roleStyle: value as StaffRoleStyle })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(StaffRoleStyle).map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Base Monthly Salary *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.baseMonthlySalary}
                    onChange={(e) => setFormData({ ...formData, baseMonthlySalary: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Role Code * (max 40 chars)</label>
                  <Input
                    value={formData.roleCode}
                    onChange={(e) => setFormData({ ...formData, roleCode: e.target.value })}
                    maxLength={40}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Role Name * (max 120 chars)</label>
                  <Input
                    value={formData.roleName}
                    onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                    maxLength={120}
                    required
                  />
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
              <TableHead>Department</TableHead>
              <TableHead>Role Style</TableHead>
              <TableHead>Role Code</TableHead>
              <TableHead>Role Name</TableHead>
              <TableHead>Delta Headcount</TableHead>
              <TableHead>Base Monthly Salary</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  No rules found
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.buildingRole}</TableCell>
                  <TableCell>{rule.metricType}</TableCell>
                  <TableCell>{rule.level}</TableCell>
                  <TableCell>{rule.departmentCode}</TableCell>
                  <TableCell>{rule.roleStyle}</TableCell>
                  <TableCell>{rule.roleCode}</TableCell>
                  <TableCell>{rule.roleName}</TableCell>
                  <TableCell>{rule.deltaHeadcount}</TableCell>
                  <TableCell>
                    {typeof rule.baseMonthlySalary === 'number' 
                      ? rule.baseMonthlySalary.toFixed(2) 
                      : parseFloat(String(rule.baseMonthlySalary || 0)).toFixed(2)}
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
              This action cannot be undone. This will permanently delete the staffing rule.
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
