//app/admin/products/TemplatesTab.tsx

/**
 * Templates Tab Component
 * Manages ProductTemplate CRUD operations
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
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import {
  ProductSeason,
  ThermalClass,
  ProductQuality,
  ProductRarity,
  ShippingProfile,
  StyleTag,
} from '@prisma/client';
import CategoryPickerDialog from '@/components/admin/products/CategoryPickerDialog';

type Template = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryL3: { id: string; name: string; code: string };
  styleTags: StyleTag[];
  productSeason: ProductSeason;
  thermalClass: ThermalClass;
  seasonScenarioDefinition: { id: string; code: string; name: string; season: string; timing: string | null; variant: string } | null;
  baseCost: string;
  suggestedSalePrice: string;
  productQuality: ProductQuality;
  productRarity: ProductRarity;
  shippingProfile: ShippingProfile;
  unlockCostXp: number | null;
  unlockCostDiamond: number | null;
  sizeProfile: { id: string; name: string } | null;
  isActive: boolean;
};

type SizeProfile = {
  id: string;
  name: string;
};

type SeasonScenarioDefinition = {
  id: string;
  code: string;
  name: string;
  season: string;
  timing: string | null;
  variant: string;
  isActive: boolean;
};

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sizeProfiles, setSizeProfiles] = useState<SizeProfile[]>([]);
  const [seasonScenarioDefinitions, setSeasonScenarioDefinitions] = useState<SeasonScenarioDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    categoryL3Id: '',
    categoryL3Label: '',
    styleTags: [] as StyleTag[],
    productSeason: 'WINTER' as ProductSeason,
    thermalClass: 'MILD' as ThermalClass,
    baseCost: '',
    suggestedSalePrice: '',
    productQuality: 'STANDARD' as ProductQuality,
    productRarity: 'STANDARD' as ProductRarity,
    shippingProfile: 'MEDIUM' as ShippingProfile,
    unlockCostXp: '',
    unlockCostDiamond: '',
    sizeProfileId: '__none__',
    seasonScenarioDefinitionId: '__none__',
    isActive: true,
  });

  useEffect(() => {
    fetchTemplates();
    fetchAllOptions();
  }, []);

  const fetchTemplates = async () => {
    try {
      const url = search
        ? `/api/admin/products/templates?search=${encodeURIComponent(search)}`
        : '/api/admin/products/templates';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } finally {
      setLoading(false);
    }
  };


  const fetchSizeProfiles = async () => {
    try {
      const res = await fetch('/api/admin/products/size-profiles');
      if (res.ok) {
        const data = await res.json();
        setSizeProfiles(data || []);
        console.log('Size profiles loaded:', data?.length || 0);
      } else {
        const errorData = await res.json();
        console.error('Failed to fetch size profiles:', errorData);
        toast({ title: 'Warning', message: 'Failed to load size profiles', kind: 'warning' });
      }
    } catch (error) {
      console.error('Error fetching size profiles:', error);
      toast({ title: 'Error', message: 'Failed to load size profiles', kind: 'error' });
    }
  };

  const fetchSeasonScenarioDefinitions = async () => {
    try {
      const res = await fetch('/api/admin/products/season-scenario-definitions');
      if (res.ok) {
        const data = await res.json();
        setSeasonScenarioDefinitions(data || []);
      }
    } catch (error) {
    }
  };

  const fetchAllOptions = async () => {
    setLoadingOptions(true);
    try {
      await Promise.all([fetchSizeProfiles(), fetchSeasonScenarioDefinitions()]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      categoryL3Id: '',
      categoryL3Label: '',
      styleTags: [],
      productSeason: 'WINTER',
      thermalClass: 'MILD',
      baseCost: '',
      suggestedSalePrice: '',
      productQuality: 'STANDARD',
      productRarity: 'STANDARD',
      shippingProfile: 'MEDIUM',
      unlockCostXp: '',
      unlockCostDiamond: '',
      sizeProfileId: '__none__',
      seasonScenarioDefinitionId: '__none__',
      isActive: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      code: template.code,
      name: template.name,
      description: template.description || '',
      categoryL3Id: template.categoryL3.id,
      categoryL3Label: `${template.categoryL3.name} (${template.categoryL3.code})`,
      styleTags: template.styleTags || [],
      productSeason: template.productSeason,
      thermalClass: template.thermalClass,
      baseCost: template.baseCost,
      suggestedSalePrice: template.suggestedSalePrice,
      productQuality: template.productQuality,
      productRarity: template.productRarity,
      shippingProfile: template.shippingProfile,
      unlockCostXp: template.unlockCostXp?.toString() || '',
      unlockCostDiamond: template.unlockCostDiamond?.toString() || '',
      sizeProfileId: template.sizeProfile?.id || '__none__',
      seasonScenarioDefinitionId: template.seasonScenarioDefinition?.id || '__none__',
      isActive: template.isActive,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate category is selected
    if (!formData.categoryL3Id) {
      toast({
        kind: 'error',
        message: 'Category is required. Please select a category.',
      });
      return;
    }

    // Normalize sizeProfileId: '__none__' or empty -> null
    const normalizedSizeProfileId = 
      !formData.sizeProfileId || 
      formData.sizeProfileId === '__none__' || 
      formData.sizeProfileId === ''
        ? null 
        : formData.sizeProfileId;

    const payload: any = {
      code: formData.code,
      name: formData.name,
      description: formData.description || null,
      categoryL3Id: formData.categoryL3Id,
      styleTags: formData.styleTags || [],
      productSeason: formData.productSeason,
      thermalClass: formData.thermalClass,
      seasonScenarioDefinitionId: formData.seasonScenarioDefinitionId === '__none__' ? null : (formData.seasonScenarioDefinitionId || null),
      baseCost: parseFloat(formData.baseCost),
      suggestedSalePrice: parseFloat(formData.suggestedSalePrice),
      productQuality: formData.productQuality,
      productRarity: formData.productRarity,
      shippingProfile: formData.shippingProfile,
      unlockCostXp: formData.unlockCostXp ? parseInt(formData.unlockCostXp) : null,
      unlockCostDiamond: formData.unlockCostDiamond ? parseInt(formData.unlockCostDiamond) : null,
      sizeProfileId: normalizedSizeProfileId,
      isActive: formData.isActive,
    };

    console.log('Submitting template with sizeProfileId:', normalizedSizeProfileId, 'from formData:', formData.sizeProfileId);

    try {
      const url = editingTemplate
        ? `/api/admin/products/templates/${editingTemplate.id}`
        : '/api/admin/products/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'Success', message: `Template ${editingTemplate ? 'updated' : 'created'} successfully`, kind: 'success' });
        setDialogOpen(false);
        fetchTemplates();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to save template', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to save template', kind: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products/templates/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Success', message: 'Template deleted successfully', kind: 'success' });
        setDeleteConfirmOpen(false);
        setDeletingId(null);
        fetchTemplates();
      } else {
        const data = await res.json();
        toast({ title: 'Error', message: data.error || 'Failed to delete template', kind: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to delete template', kind: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <ModaVerseLogoLoader size={48} className="text-primary" />
        <span className="text-muted-foreground">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Templates</h2>
        <Dialog 
          open={dialogOpen} 
          onOpenChange={(open) => {
            setDialogOpen(open);
            // Refresh options when modal opens
            if (open && (sizeProfiles.length === 0 || seasonScenarioDefinitions.length === 0)) {
              fetchAllOptions();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
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
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category (L3) *</label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.categoryL3Label}
                      placeholder="No category selected"
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => setCategoryPickerOpen(true)}
                      variant="outline"
                    >
                      Choose
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Style Tags</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.values(StyleTag).map((tag) => (
                      <label key={tag} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.styleTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                styleTags: [...formData.styleTags, tag],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                styleTags: formData.styleTags.filter((t) => t !== tag),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Season *</label>
                  <Select
                    value={formData.productSeason}
                    onValueChange={(value) => setFormData({ ...formData, productSeason: value as ProductSeason })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WINTER">WINTER</SelectItem>
                      <SelectItem value="SUMMER">SUMMER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Thermal Class *</label>
                  <Select
                    value={formData.thermalClass}
                    onValueChange={(value) => setFormData({ ...formData, thermalClass: value as ThermalClass })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ThermalClass).map((tc) => (
                        <SelectItem key={tc} value={tc}>
                          {tc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Base Cost (USD) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.baseCost}
                    onChange={(e) => setFormData({ ...formData, baseCost: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Suggested Sale Price (USD) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.suggestedSalePrice}
                    onChange={(e) => setFormData({ ...formData, suggestedSalePrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Quality *</label>
                  <Select
                    value={formData.productQuality}
                    onValueChange={(value) => setFormData({ ...formData, productQuality: value as ProductQuality })}
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
                <div>
                  <label className="text-sm font-medium">Rarity</label>
                  <Select
                    value={formData.productRarity}
                    onValueChange={(value) => setFormData({ ...formData, productRarity: value as ProductRarity })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ProductRarity).map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Shipping Profile</label>
                  <Select
                    value={formData.shippingProfile}
                    onValueChange={(value) => setFormData({ ...formData, shippingProfile: value as ShippingProfile })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ShippingProfile).map((sp) => (
                        <SelectItem key={sp} value={sp}>
                          {sp}
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
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unlock Cost (Diamond)</label>
                  <Input
                    type="number"
                    value={formData.unlockCostDiamond}
                    onChange={(e) => setFormData({ ...formData, unlockCostDiamond: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Size Profile</label>
                  <Select
                    value={formData.sizeProfileId || '__none__'}
                    onValueChange={(value) => setFormData({ ...formData, sizeProfileId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {sizeProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Season Scenario Definition</label>
                  <Select
                    value={formData.seasonScenarioDefinitionId || '__none__'}
                    onValueChange={(value) => setFormData({ ...formData, seasonScenarioDefinitionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {seasonScenarioDefinitions.map((def) => (
                        <SelectItem key={def.id} value={def.id}>
                          {def.name} ({def.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              // Debounce search
              setTimeout(() => {
                fetchTemplates();
              }, 500);
            }}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Style Tags</TableHead>
              <TableHead>Base Cost</TableHead>
              <TableHead>Sale Price</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No templates found
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>{template.code}</TableCell>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>{template.categoryL3.name}</TableCell>
                  <TableCell>
                    {template.styleTags && template.styleTags.length > 0
                      ? template.styleTags.join(', ')
                      : '-'}
                  </TableCell>
                  <TableCell>${template.baseCost}</TableCell>
                  <TableCell>${template.suggestedSalePrice}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(template.id);
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
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this template? This action cannot be undone.
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

      {/* Category Picker Dialog */}
      <CategoryPickerDialog
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        selectedId={formData.categoryL3Id}
        onSelect={(category) => {
          setFormData({
            ...formData,
            categoryL3Id: category.id,
            categoryL3Label: `${category.pathLabel} (${category.code})`,
          });
        }}
      />
    </div>
  );
}
